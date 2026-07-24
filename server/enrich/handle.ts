import { emailFinder, hunterConfigured, HunterError } from "./hunter.js";
import { readContactsGrid, writeEmails } from "./contactsSheet.js";

/**
 * Find emails for an account's contacts (LAB-34).
 *
 * Given an account and its contacts (name + id), ask Hunter for each person's
 * email at that company, write the found ones back into the Contacts sheet, and
 * return a per-contact result the UI can show. Contacts that already have an
 * email are skipped. One contact's failure never aborts the rest.
 */

const DEFAULT_DOMAIN = "lab-2-scale.com";

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface GoogleUserInfo {
  hd?: string;
  email?: string;
  email_verified?: boolean | string;
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
    throw new HttpError(403, `${who} is ${seen}, but this server only allows "${allowedDomain}".`);
  }
}

export interface FindEmailsRequest {
  authHeader?: string;
  body: unknown;
}

export interface EmailResult {
  id: string;
  name: string;
  email: string | null;
  score: number | null;
  /** "found" | "not_found" | "skipped" (already had one) | "error" */
  outcome: "found" | "not_found" | "skipped" | "error";
  message?: string;
}

export interface FindEmailsResponse {
  status: number;
  body:
    | { results: EmailResult[]; written: number; found: number; sheetUrl: string }
    | { error: string };
}

interface InContact {
  id: string;
  name: string;
  company?: string;
  hasEmail?: boolean;
}

function parse(req: FindEmailsRequest):
  | { token: string; driveId: string; account: string; contacts: InContact[] }
  | { error: FindEmailsResponse } {
  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: { status: 401, body: { error: "Missing sign-in token." } } };
  const body = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const driveId = str(body.driveId);
  const account = str(body.account);
  if (!driveId) return { error: { status: 400, body: { error: "Missing drive id." } } };
  if (!account) return { error: { status: 400, body: { error: "Missing account name." } } };
  const raw = Array.isArray(body.contacts) ? body.contacts : [];
  const contacts: InContact[] = raw
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        id: str(o.id),
        name: str(o.name),
        company: str(o.company) || undefined,
        hasEmail: Boolean(o.hasEmail),
      };
    })
    .filter((c) => c.id && c.name);
  if (contacts.length === 0) {
    return { error: { status: 400, body: { error: "No contacts with a name to look up." } } };
  }
  return { token, driveId, account, contacts };
}

export async function handleFindEmails(req: FindEmailsRequest): Promise<FindEmailsResponse> {
  if (!hunterConfigured()) {
    return { status: 500, body: { error: "Email enrichment isn't configured — set HUNTER_API_KEY on the server (Railway)." } };
  }
  const parsed = parse(req);
  if ("error" in parsed) return parsed.error;
  const { token, driveId, account, contacts } = parsed;

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());

    const results: EmailResult[] = [];
    const emailById = new Map<string, string>();

    for (const c of contacts) {
      if (c.hasEmail) {
        results.push({ id: c.id, name: c.name, email: null, score: null, outcome: "skipped" });
        continue;
      }
      try {
        // The contact's employer is their own company when set, else the account.
        const found = await emailFinder({ fullName: c.name, company: c.company || account });
        if (found.email) {
          emailById.set(c.id, found.email);
          results.push({ id: c.id, name: c.name, email: found.email, score: found.score, outcome: "found" });
        } else {
          results.push({ id: c.id, name: c.name, email: null, score: null, outcome: "not_found" });
        }
      } catch (e) {
        const message = e instanceof HunterError ? e.message : e instanceof Error ? e.message : "Lookup failed.";
        results.push({ id: c.id, name: c.name, email: null, score: null, outcome: "error", message });
        // A 401/429 is systemic — stop hammering Hunter for the rest.
        if (e instanceof HunterError && (e.status === 401 || e.status === 429)) break;
      }
    }

    // Write whatever we found back into the sheet (empty cells only).
    let written = 0;
    let sheetUrl = "";
    if (emailById.size > 0) {
      const grid = await readContactsGrid(token, driveId, driveId);
      sheetUrl = grid.sheetUrl;
      written = await writeEmails(token, grid, emailById);
    }

    const found = results.filter((r) => r.outcome === "found").length;
    return { status: 200, body: { results, written, found, sheetUrl } };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    if (err instanceof HunterError) return { status: err.status, body: { error: err.message } };
    if (err instanceof Error) return { status: 502, body: { error: err.message } };
    return { status: 500, body: { error: "Something went wrong finding emails." } };
  }
}
