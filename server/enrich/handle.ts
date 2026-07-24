import { emailFinder, hunterConfigured, HunterError } from "./hunter.js";
import { readContactsGrid, writeEmails, columnIndex } from "./contactsSheet.js";
import { readAccountContacts, writeContactEmails, headerIndex } from "./accountContacts.js";

/**
 * Find emails for the contacts in the Contacts sheet (LAB-34).
 *
 * The server reads the whole Contacts sheet — the source of truth — walks every
 * contact, and for each one missing an email asks Hunter for it, then writes the
 * found ones back into the sheet. Contacts that already have an email are left
 * untouched (we never overwrite a human's entry, and it saves Hunter credits).
 * One contact's failure never aborts the rest; a systemic 401/429 stops early.
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
  name: string;
  company: string;
  email: string | null;
  score: number | null;
  /** "found" | "not_found" | "skipped" (already had one) | "error" */
  outcome: "found" | "not_found" | "skipped" | "error";
  message?: string;
}

export interface FindEmailsResponse {
  status: number;
  body:
    | { results: EmailResult[]; total: number; found: number; written: number; skipped: number; sheetUrl: string }
    | { error: string };
}

function parseDriveId(
  req: FindEmailsRequest,
): { token: string; driveId: string; account: string } | { error: FindEmailsResponse } {
  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: { status: 401, body: { error: "Missing sign-in token." } } };
  const body = (req.body ?? {}) as Record<string, unknown>;
  const driveId = typeof body.driveId === "string" ? body.driveId.trim() : "";
  // Optional: scope enrichment to one account's contacts. Absent = whole sheet.
  const account = typeof body.account === "string" ? body.account.trim() : "";
  if (!driveId) return { error: { status: 400, body: { error: "Missing drive id." } } };
  return { token, driveId, account };
}

/**
 * Enrich contacts in the Contacts sheet. Reads the sheet, finds emails for the
 * ones without, and writes them back. When `account` is given, only that
 * account's contacts (matched by account or company name) are processed.
 */
export async function handleFindEmails(req: FindEmailsRequest): Promise<FindEmailsResponse> {
  if (!hunterConfigured()) {
    return { status: 500, body: { error: "Email enrichment isn't configured — set HUNTER_API_KEY on the server (Railway)." } };
  }
  const parsed = parseDriveId(req);
  if ("error" in parsed) return parsed.error;
  const { token, driveId, account } = parsed;

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());

    const grid = await readContactsGrid(token, driveId, driveId);
    const idIdx = columnIndex(grid.headers, ["id"]);
    const nameIdx = columnIndex(grid.headers, ["name"]);
    const emailIdx = columnIndex(grid.headers, ["email"]);
    const companyIdx = columnIndex(grid.headers, ["company"]);
    const accountIdx = columnIndex(grid.headers, ["account"]);
    if (nameIdx < 0) {
      return { status: 422, body: { error: "The Contacts sheet has no name column to look up." } };
    }

    const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    // Scope to one account's rows when requested (match account or company col).
    const want = account.toLowerCase();
    const rows = want
      ? grid.rows.filter(
          (r) => cell(r, accountIdx).toLowerCase() === want || cell(r, companyIdx).toLowerCase() === want,
        )
      : grid.rows;

    const results: EmailResult[] = [];
    const emailById = new Map<string, string>();
    let stopped = false;

    for (const row of rows) {
      const name = cell(row, nameIdx);
      if (!name) continue; // blank row
      const company = cell(row, companyIdx) || cell(row, accountIdx);
      const existing = cell(row, emailIdx);
      const id = cell(row, idIdx);

      if (existing) {
        results.push({ name, company, email: existing, score: null, outcome: "skipped" });
        continue;
      }
      if (stopped) {
        results.push({ name, company, email: null, score: null, outcome: "error", message: "Stopped after a Hunter error." });
        continue;
      }
      try {
        const found = await emailFinder({ fullName: name, company: company || undefined });
        if (found.email) {
          if (id) emailById.set(id, found.email);
          results.push({ name, company, email: found.email, score: found.score, outcome: "found" });
        } else {
          results.push({ name, company, email: null, score: null, outcome: "not_found" });
        }
      } catch (e) {
        const message = e instanceof HunterError ? e.message : e instanceof Error ? e.message : "Lookup failed.";
        results.push({ name, company, email: null, score: null, outcome: "error", message });
        // 401 (bad key) / 429 (quota or restricted) is systemic — stop looking up
        // the rest, but still report them so the count is honest.
        if (e instanceof HunterError && (e.status === 401 || e.status === 429)) stopped = true;
      }
    }

    const written = emailById.size > 0 ? await writeEmails(token, grid, emailById) : 0;
    const found = results.filter((r) => r.outcome === "found").length;
    const skipped = results.filter((r) => r.outcome === "skipped").length;

    return {
      status: 200,
      body: { results, total: results.length, found, written, skipped, sheetUrl: grid.sheetUrl },
    };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    if (err instanceof HunterError) return { status: err.status, body: { error: err.message } };
    if (err instanceof Error) return { status: 502, body: { error: err.message } };
    return { status: 500, body: { error: "Something went wrong finding emails." } };
  }
}

// ── Per-account: enrich the finder's "<Account> — contacts" sheet ────────────

/**
 * Find emails for every row in an account's finder contacts sheet
 * ("<Account> — contacts"), and write them into that sheet's Email column.
 * This is the sheet the "Find contacts with AI" step writes to — distinct from
 * the central Contacts sheet.
 */
export async function handleFindContactEmails(req: FindEmailsRequest): Promise<FindEmailsResponse> {
  if (!hunterConfigured()) {
    return { status: 500, body: { error: "Email enrichment isn't configured — set HUNTER_API_KEY on the server (Railway)." } };
  }
  const token = (req.authHeader ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { status: 401, body: { error: "Missing sign-in token." } };
  const body = (req.body ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const driveId = str(body.driveId);
  const accountName = str(body.accountName);
  const accountFolderId = str(body.accountFolderId);
  if (!driveId) return { status: 400, body: { error: "Missing drive id." } };
  if (!accountName) return { status: 400, body: { error: "Missing account name." } };
  if (!accountFolderId) return { status: 400, body: { error: "Missing account folder id." } };

  try {
    await verifyGoogleDomain(token, (process.env.ALLOWED_DOMAIN || DEFAULT_DOMAIN).trim());

    const sheet = await readAccountContacts(token, driveId, accountFolderId, accountName);
    if (!sheet) {
      return {
        status: 404,
        body: { error: 'No contacts sheet for this account yet — run "Find contacts for approved" first.' },
      };
    }

    const nameIdx = headerIndex(sheet.headers, ["name"]);
    const companyIdx = headerIndex(sheet.headers, ["company"]);
    let emailIdx = headerIndex(sheet.headers, ["email"]);
    if (emailIdx < 0) emailIdx = 3; // finder layout: Name, Title, Company, Email, …
    if (nameIdx < 0) {
      return { status: 422, body: { error: "That contacts sheet has no Name column to look up." } };
    }

    const cell = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");

    const results: EmailResult[] = [];
    const updates: { rowNumber: number; email: string }[] = [];
    let stopped = false;

    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      const name = cell(row, nameIdx);
      if (!name) continue;
      const company = cell(row, companyIdx) || accountName;
      const existing = cell(row, emailIdx);
      if (existing) {
        results.push({ name, company, email: existing, score: null, outcome: "skipped" });
        continue;
      }
      if (stopped) {
        results.push({ name, company, email: null, score: null, outcome: "error", message: "Stopped after a Hunter error." });
        continue;
      }
      try {
        const found = await emailFinder({ fullName: name, company: company || undefined });
        if (found.email) {
          updates.push({ rowNumber: sheet.firstDataRow + i, email: found.email });
          results.push({ name, company, email: found.email, score: found.score, outcome: "found" });
        } else {
          results.push({ name, company, email: null, score: null, outcome: "not_found" });
        }
      } catch (e) {
        const message = e instanceof HunterError ? e.message : e instanceof Error ? e.message : "Lookup failed.";
        results.push({ name, company, email: null, score: null, outcome: "error", message });
        if (e instanceof HunterError && (e.status === 401 || e.status === 429)) stopped = true;
      }
    }

    const written = updates.length > 0 ? await writeContactEmails(token, sheet.sheetId, emailIdx, updates) : 0;
    const found = results.filter((r) => r.outcome === "found").length;
    const skipped = results.filter((r) => r.outcome === "skipped").length;

    return {
      status: 200,
      body: { results, total: results.length, found, written, skipped, sheetUrl: sheet.sheetUrl },
    };
  } catch (err) {
    if (err instanceof HttpError) return { status: err.status, body: { error: err.message } };
    if (err instanceof HunterError) return { status: err.status, body: { error: err.message } };
    if (err instanceof Error) return { status: 502, body: { error: err.message } };
    return { status: 500, body: { error: "Something went wrong finding emails." } };
  }
}
