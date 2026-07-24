/** Client for contact enrichment (server-side Hunter.io → writes emails to the Contacts sheet). */
import { CONFIG } from "@/config";

export interface EmailResult {
  name: string;
  company: string;
  email: string | null;
  score: number | null;
  outcome: "found" | "not_found" | "skipped" | "error";
  message?: string;
}

export interface FindEmailsResult {
  results: EmailResult[];
  total: number;
  found: number;
  written: number;
  skipped: number;
  sheetUrl: string;
}

/**
 * Find emails for contacts in the Contacts sheet. The server reads the sheet,
 * calls Hunter (its key never touches the browser) for contacts missing an
 * email, and writes the found ones back. Pass `account` to scope enrichment to
 * one account's contacts; omit it to enrich the whole sheet.
 */
export async function findEmails(token: string, account?: string): Promise<FindEmailsResult> {
  let res: Response;
  try {
    res = await fetch(`${CONFIG.apiBaseUrl}/api/find-emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ driveId: CONFIG.driveFolderId, ...(account ? { account } : {}) }),
    });
  } catch {
    throw new Error("Couldn't reach the server (it may be redeploying). Try again in a moment.");
  }
  const data = (await res.json().catch(() => ({}))) as Partial<FindEmailsResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return {
    results: data.results ?? [],
    total: data.total ?? 0,
    found: data.found ?? 0,
    written: data.written ?? 0,
    skipped: data.skipped ?? 0,
    sheetUrl: data.sheetUrl ?? "",
  };
}
