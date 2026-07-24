/** Client for the lead qualifier (server-side Claude → writes verdicts to the Leads sheet). */
import { CONFIG } from "@/config";

export interface QualifyResult {
  total: number;
  pursue: number;
  gate: number;
  pass: number;
  sheetUrl: string;
  rulesUrl: string;
  rulesCreated: boolean;
}

async function post<T>(path: string, token: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${CONFIG.apiBaseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ driveId: CONFIG.driveFolderId, ...body }),
    });
  } catch {
    // fetch() throws (not an HTTP error) when the server is unreachable — e.g.
    // Railway is redeploying. Make that legible instead of a raw "Failed to fetch".
    throw new Error("Couldn't reach the server (it may be redeploying). Try again in a moment, or edit the Leads sheet directly.");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data;
}

function toResult(data: Partial<QualifyResult>): QualifyResult {
  return {
    total: data.total ?? 0,
    pursue: data.pursue ?? 0,
    gate: data.gate ?? 0,
    pass: data.pass ?? 0,
    sheetUrl: data.sheetUrl ?? "",
    rulesUrl: data.rulesUrl ?? "",
    rulesCreated: data.rulesCreated ?? false,
  };
}

/** Qualify a single lead against the rules doc and write the verdict back. */
export async function qualifyLead(
  token: string,
  company: string,
  rowIndex: number,
): Promise<QualifyResult> {
  return toResult(await post<Partial<QualifyResult>>("/api/qualify-lead", token, { company, rowIndex }));
}

/** Delete a lead row from the sheet (destructive — confirm in the UI first). */
export async function deleteLead(token: string, company: string, rowIndex: number): Promise<void> {
  await post<{ deleted: true }>("/api/delete-lead", token, { company, rowIndex });
}
