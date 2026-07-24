/** Client for the two-stage async finder (server-side Claude → per-account sheets). */
import { CONFIG } from "@/config";

export interface FinderStarted {
  /** Link to the sheet where results will appear. */
  sheetUrl: string;
  message: string;
}

export interface FinderParams {
  accountName: string;
  accountFolderId: string;
}

async function start(path: string, token: string, params: FinderParams): Promise<FinderStarted> {
  // The server resolves the account's context itself (finding or generating the
  // context doc from the account's documents), so the browser sends only ids.
  const res = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountName: params.accountName,
      accountFolderId: params.accountFolderId,
      driveId: CONFIG.driveFolderId,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    sheetUrl?: string;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Couldn't start the finder (${res.status}).`);
  }
  return {
    sheetUrl: data.sheetUrl ?? "",
    message: data.message ?? "Started — results will appear in the sheet shortly.",
  };
}

/** Stage 1: research target companies into the account's companies sheet. */
export function startFindCompanies(token: string, params: FinderParams): Promise<FinderStarted> {
  return start("/api/find-companies", token, params);
}

/** Stage 2: research contacts at the approved companies into the contacts sheet. */
export function startFindContacts(token: string, params: FinderParams): Promise<FinderStarted> {
  return start("/api/find-contacts", token, params);
}

export interface ContactEmailsResult {
  results: { name: string; company: string; email: string | null; outcome: string }[];
  total: number;
  found: number;
  written: number;
  skipped: number;
  sheetUrl: string;
}

/**
 * Find emails for every row in this account's finder contacts sheet
 * ("<Account> — contacts") and write them into its Email column. Synchronous —
 * returns a summary when done.
 */
export async function findContactEmails(token: string, params: FinderParams): Promise<ContactEmailsResult> {
  let res: Response;
  try {
    res = await fetch(`${CONFIG.apiBaseUrl}/api/find-contact-emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        accountName: params.accountName,
        accountFolderId: params.accountFolderId,
        driveId: CONFIG.driveFolderId,
      }),
    });
  } catch {
    throw new Error("Couldn't reach the server (it may be redeploying). Try again in a moment.");
  }
  const data = (await res.json().catch(() => ({}))) as Partial<ContactEmailsResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || `Couldn't find emails (${res.status}).`);
  return {
    results: data.results ?? [],
    total: data.total ?? 0,
    found: data.found ?? 0,
    written: data.written ?? 0,
    skipped: data.skipped ?? 0,
    sheetUrl: data.sheetUrl ?? "",
  };
}
