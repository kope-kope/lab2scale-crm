/** Client for the lead qualifier (server-side Claude → writes verdicts to the Leads sheet). */
import { CONFIG } from "@/config";

export interface QualifyResult {
  total: number;
  qualified: number;
  disqualified: number;
  sheetUrl: string;
  rulesUrl: string;
  rulesCreated: boolean;
}

/** Qualify every lead against the rules doc and write the verdicts back. */
export async function qualifyLeads(token: string): Promise<QualifyResult> {
  const res = await fetch(`${CONFIG.apiBaseUrl}/api/qualify-leads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ driveId: CONFIG.driveFolderId }),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<QualifyResult> & { error?: string };
  if (!res.ok) throw new Error(data.error || `Couldn't qualify leads (${res.status}).`);
  return {
    total: data.total ?? 0,
    qualified: data.qualified ?? 0,
    disqualified: data.disqualified ?? 0,
    sheetUrl: data.sheetUrl ?? "",
    rulesUrl: data.rulesUrl ?? "",
    rulesCreated: data.rulesCreated ?? false,
  };
}
