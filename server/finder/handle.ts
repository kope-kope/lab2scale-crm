import Anthropic from "@anthropic-ai/sdk";
import { findCompanies } from "./findCompanies.js";
import { findContacts } from "./findContacts.js";
import {
  findOrCreateSheet,
  companiesSheetName,
  contactsSheetName,
  writeStatus,
  appendCompanies,
  writeContacts,
  readAllCompanies,
  readApprovedCompanies,
} from "./sheet.js";

/**
 * The two async finder stages.
 *
 *   handleFindCompanies — Stage 1: research target companies → companies sheet.
 *   handleFindContacts  — Stage 2: read approved companies → contacts sheet.
 *
 * Both validate + domain-gate + create/find the sheet synchronously, respond
 * immediately with the sheet link, and return a `run` closure the route fires
 * in the background (the research writes results + status into the sheet).
 */

export interface FinderResponse {
  status: number;
  body: { started: true; sheetUrl: string; message: string } | { error: string };
  run?: () => Promise<void>;
}

const DEFAULT_DOMAIN = "lab-2-scale.com";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface FinderRequest {
  authHeader?: string;
  body: unknown;
}

interface Parsed {
  apiKey: string;
  token: string;
  accountName: string;
  accountFolderId: string;
  driveId: string;
  contextText: string;
}

interface GoogleUserInfo {
  hd?: string;
  email?: string;
  email_verified?: boolean | string;
}

function nowStamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Shared validation. Returns the parsed fields or an early error response. */
function parse(req: FinderRequest): { ok: true; v: Parsed } | { ok: false; res: FinderResponse } {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return err(500, "AI isn't configured yet — set ANTHROPIC_API_KEY on the server.");
  }
  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return err(401, "Missing sign-in token.");

  const body = (req.body ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof body[k] === "string" ? (body[k] as string).trim() : "");
  const accountName = str("accountName");
  const accountFolderId = str("accountFolderId");
  const driveId = str("driveId");
  const contextText = typeof body.contextText === "string" ? body.contextText : "";
  if (!accountName) return err(400, "Missing account name.");
  if (!accountFolderId) return err(400, "Missing account folder id.");
  if (!driveId) return err(400, "Missing drive id.");

  return { ok: true, v: { apiKey, token, accountName, accountFolderId, driveId, contextText } };
}

function err(status: number, message: string): { ok: false; res: FinderResponse } {
  return { ok: false, res: { status, body: { error: message } } };
}

async function verifyGoogleDomain(accessToken: string, allowedDomain: string): Promise<void> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new HttpError(401, "Your Google session expired — sign in again.");
  const info = (await res.json()) as GoogleUserInfo;
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.hd !== allowedDomain || !verified) {
    const who = info.email || "This account";
    const seen = info.hd ? `a "${info.hd}" account` : "a personal account (no Workspace domain)";
    throw new HttpError(
      403,
      `${who} is ${seen}, but this server only allows "${allowedDomain}". ` +
        `If that's wrong, fix ALLOWED_DOMAIN on the server (Railway).`,
    );
  }
}

function mapError(err: unknown): FinderResponse {
  if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
  if (err instanceof Error) return { status: 502, body: { error: `Couldn't start the finder. ${err.message}` } };
  return { status: 500, body: { error: "Something went wrong starting the finder." } };
}

function failureReason(e: unknown): string {
  if (e instanceof Anthropic.APIError) return `AI request failed (${e.status ?? "?"}) — ${e.message}`;
  return e instanceof Error ? e.message : "unknown error";
}

// ── Stage 1 · Find companies ───────────────────────────────────────────────

export async function handleFindCompanies(req: FinderRequest): Promise<FinderResponse> {
  const parsed = parse(req);
  if (!parsed.ok) return parsed.res;
  const { apiKey, token, accountName, accountFolderId, driveId, contextText } = parsed.v;

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());
    const sheet = await findOrCreateSheet(token, driveId, accountFolderId, companiesSheetName(accountName));
    await writeStatus(token, sheet.id, `Running… finding target companies (started ${nowStamp()})`);

    const run = async () => {
      try {
        // Dedup: exclude companies already on the sheet, and append (not replace)
        // so re-running adds new ones while keeping existing rows + Approve marks.
        const existing = await readAllCompanies(token, sheet.id);
        const { companies, note } = await findCompanies(apiKey, accountName, contextText, existing);
        await appendCompanies(token, sheet.id, companies);
        const total = existing.length + companies.length;
        const noun = companies.length === 1 ? "company" : "companies";
        const summary = companies.length
          ? `Done — added ${companies.length} new ${noun} (${total} total). Mark the ones to pursue with "yes" in the Approve column, then run Step 2. (${nowStamp()})`
          : existing.length
            ? `Done — no new companies to add; ${existing.length} already on the list${note ? `. ${note}` : ""} (${nowStamp()})`
            : `Done — no companies found${note ? `: ${note}` : ""} (${nowStamp()})`;
        await writeStatus(token, sheet.id, summary);
      } catch (e) {
        await writeStatus(token, sheet.id, `Failed: ${failureReason(e)} (${nowStamp()})`).catch(() => {});
        throw e;
      }
    };

    return {
      status: 202,
      body: {
        started: true,
        sheetUrl: sheet.url,
        message: "Finding target companies — they'll appear in the companies sheet in a few minutes.",
      },
      run,
    };
  } catch (e) {
    return mapError(e);
  }
}

// ── Stage 2 · Find contacts at approved companies ──────────────────────────

export async function handleFindContacts(req: FinderRequest): Promise<FinderResponse> {
  const parsed = parse(req);
  if (!parsed.ok) return parsed.res;
  const { apiKey, token, accountName, accountFolderId, driveId, contextText } = parsed.v;

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());

    // Read the approved companies from Stage 1's sheet.
    const companiesSheet = await findOrCreateSheet(
      token,
      driveId,
      accountFolderId,
      companiesSheetName(accountName),
    );
    const approved = await readApprovedCompanies(token, companiesSheet.id);
    if (approved.length === 0) {
      return {
        status: 409,
        body: {
          error:
            'No approved companies yet. Run "Find target companies" first, then type "yes" in the Approve column for the ones to pursue.',
        },
      };
    }

    const sheet = await findOrCreateSheet(token, driveId, accountFolderId, contactsSheetName(accountName));
    await writeStatus(
      token,
      sheet.id,
      `Running… finding contacts at ${approved.length} approved companies (started ${nowStamp()})`,
    );

    const run = async () => {
      try {
        const { contacts, note } = await findContacts(apiKey, accountName, contextText, approved);
        await writeContacts(token, sheet.id, contacts);
        const summary = contacts.length
          ? `Done — ${contacts.length} contacts across ${approved.length} companies (${nowStamp()})`
          : `Done — no contacts found${note ? `: ${note}` : ""} (${nowStamp()})`;
        await writeStatus(token, sheet.id, summary);
      } catch (e) {
        await writeStatus(token, sheet.id, `Failed: ${failureReason(e)} (${nowStamp()})`).catch(() => {});
        throw e;
      }
    };

    return {
      status: 202,
      body: {
        started: true,
        sheetUrl: sheet.url,
        message: `Finding contacts at ${approved.length} approved companies — they'll appear in the contacts sheet in a few minutes.`,
      },
      run,
    };
  } catch (e) {
    return mapError(e);
  }
}
