/** Client for the async AI contact finder (server-side Claude → per-account sheet). */
import { CONFIG } from "@/config";

export interface FinderStarted {
  /** Link to the account's targets sheet where results will appear. */
  sheetUrl: string;
  message: string;
}

/**
 * Kick off a finder run for an account. The server creates/opens the account's
 * targets sheet, returns its link immediately, and does the research in the
 * background — results land in the sheet. We don't wait for contacts here.
 */
export async function startFindContacts(
  token: string,
  params: { accountName: string; accountFolderId: string; contextText: string },
): Promise<FinderStarted> {
  const res = await fetch(`${CONFIG.apiBaseUrl}/api/find-contacts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      accountName: params.accountName,
      accountFolderId: params.accountFolderId,
      driveId: CONFIG.driveFolderId,
      contextText: params.contextText,
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
    message: data.message ?? "Finding contacts — results will appear in the sheet shortly.",
  };
}
