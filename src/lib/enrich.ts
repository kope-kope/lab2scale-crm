/** Client for contact enrichment (server-side Hunter.io → writes emails to the Contacts sheet). */
import { CONFIG } from "@/config";

export interface EmailResult {
  id: string;
  name: string;
  email: string | null;
  score: number | null;
  outcome: "found" | "not_found" | "skipped" | "error";
  message?: string;
}

export interface FindEmailsResult {
  results: EmailResult[];
  written: number;
  found: number;
  sheetUrl: string;
}

export interface ContactRef {
  id: string;
  name: string;
  company?: string;
  hasEmail?: boolean;
}

/**
 * Find emails for an account's contacts. The server calls Hunter (its key never
 * touches the browser) and writes found emails back into the Contacts sheet.
 */
export async function findEmailsForAccount(
  token: string,
  account: string,
  contacts: ContactRef[],
): Promise<FindEmailsResult> {
  let res: Response;
  try {
    res = await fetch(`${CONFIG.apiBaseUrl}/api/find-emails`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ driveId: CONFIG.driveFolderId, account, contacts }),
    });
  } catch {
    throw new Error("Couldn't reach the server (it may be redeploying). Try again in a moment.");
  }
  const data = (await res.json().catch(() => ({}))) as Partial<FindEmailsResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return {
    results: data.results ?? [],
    written: data.written ?? 0,
    found: data.found ?? 0,
    sheetUrl: data.sheetUrl ?? "",
  };
}
