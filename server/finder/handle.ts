import Anthropic from "@anthropic-ai/sdk";
import { findContacts } from "./findContacts.js";
import { findOrCreateTargetsSheet, writeStatus, writeContacts } from "./sheet.js";

/**
 * Handler for the async contact finder.
 *
 * The finder does minutes of web research — too long to hold an HTTP connection
 * open (the edge proxy kills it). So instead: we validate, create the account's
 * "targets" sheet, and respond immediately with its link. The actual research
 * then runs in the background (`run`) and writes results + status into that
 * sheet. The browser never waits. This only works because the API runs on a
 * persistent server (Railway), not serverless.
 */

export interface FinderResponse {
  status: number;
  body: { started: true; sheetUrl: string; message: string } | { error: string };
  /** When present, the caller should invoke this AFTER responding — the background job. */
  run?: () => Promise<void>;
}

const DEFAULT_DOMAIN = "lab-2-scale.com";

interface GoogleUserInfo {
  hd?: string;
  email?: string;
  email_verified?: boolean | string;
}

async function verifyGoogleDomain(accessToken: string, allowedDomain: string): Promise<void> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new HttpError(401, "Your Google session expired — sign in again.");
  }
  const info = (await res.json()) as GoogleUserInfo;
  const verified = info.email_verified === true || info.email_verified === "true";
  if (info.hd !== allowedDomain || !verified) {
    // Self-revealing: name what the server saw vs. what it expects, so a
    // frontend/server domain-config mismatch is obvious instead of a dead end.
    const who = info.email || "This account";
    const seen = info.hd ? `a "${info.hd}" account` : "a personal account (no Workspace domain)";
    throw new HttpError(
      403,
      `${who} is ${seen}, but this server only allows "${allowedDomain}". ` +
        `If that's wrong, fix ALLOWED_DOMAIN on the server (Railway).`,
    );
  }
}

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

function nowStamp(): string {
  // e.g. "2026-07-18 14:32 UTC" — readable in the sheet.
  return new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * Validate, authorize, create the sheet, and hand back a 202 plus a `run`
 * closure for the background research. Never throws — always returns a response.
 */
export async function handleFindContacts(req: FinderRequest): Promise<FinderResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { status: 500, body: { error: "AI isn't configured yet — set ANTHROPIC_API_KEY on the server." } };
  }

  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return { status: 401, body: { error: "Missing sign-in token." } };
  }

  const body = (req.body ?? {}) as {
    accountName?: unknown;
    accountFolderId?: unknown;
    driveId?: unknown;
    contextText?: unknown;
  };
  const accountName = typeof body.accountName === "string" ? body.accountName.trim() : "";
  const accountFolderId = typeof body.accountFolderId === "string" ? body.accountFolderId.trim() : "";
  const driveId = typeof body.driveId === "string" ? body.driveId.trim() : "";
  const contextText = typeof body.contextText === "string" ? body.contextText : "";
  if (!accountName) return { status: 400, body: { error: "Missing account name." } };
  if (!accountFolderId) return { status: 400, body: { error: "Missing account folder id." } };
  if (!driveId) return { status: 400, body: { error: "Missing drive id." } };

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());

    // Create/find the sheet synchronously so we can return its link now.
    const sheet = await findOrCreateTargetsSheet(token, driveId, accountFolderId, accountName);
    await writeStatus(token, sheet.id, `Running… searching the web (started ${nowStamp()})`);

    // The background job: research, then write results + final status. It owns
    // its own error handling so failures land in the sheet, not a dropped promise.
    const run = async () => {
      try {
        const result = await findContacts(apiKey, accountName, contextText);
        await writeContacts(token, sheet.id, result.contacts);
        const summary = result.contacts.length
          ? `Done — ${result.contacts.length} contacts (${nowStamp()})`
          : `Done — no contacts found${result.note ? `: ${result.note}` : ""} (${nowStamp()})`;
        await writeStatus(token, sheet.id, summary);
      } catch (err) {
        const reason =
          err instanceof Anthropic.APIError
            ? `AI request failed (${err.status ?? "?"}) — ${err.message}`
            : err instanceof Error
              ? err.message
              : "unknown error";
        await writeStatus(token, sheet.id, `Failed: ${reason} (${nowStamp()})`).catch(() => {});
        throw err;
      }
    };

    return {
      status: 202,
      body: {
        started: true,
        sheetUrl: sheet.url,
        message: "Finding contacts — results will appear in the sheet in a few minutes.",
      },
      run,
    };
  } catch (err) {
    if (err instanceof HttpError) {
      return { status: err.status, body: { error: err.message } };
    }
    if (err instanceof Error) {
      return { status: 502, body: { error: `Couldn't start the finder. ${err.message}` } };
    }
    return { status: 500, body: { error: "Something went wrong starting the finder." } };
  }
}
