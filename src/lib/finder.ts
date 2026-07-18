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
  contextText: string;
}

async function start(path: string, token: string, params: FinderParams): Promise<FinderStarted> {
  const res = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
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
