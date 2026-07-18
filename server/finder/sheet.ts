import type { FoundContact } from "./findContacts.js";

/**
 * Server-side Google Drive + Sheets writes for the async finder. The finder
 * runs detached (the browser isn't waiting), so results and run status are
 * written into a per-account "targets" sheet in the account's Drive folder.
 * Everything is done as the signed-in user, using their access token.
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

const HEADER = ["Name", "Title", "Company", "Email", "LinkedIn", "Rationale"];

function reasonFrom(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    return j.error?.message ? ` ${j.error.message}` : "";
  } catch {
    return "";
  }
}

async function google(url: string, token: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Google API ${res.status}.${detail}`);
  }
  return res.json();
}

export interface TargetsSheet {
  id: string;
  url: string;
  created: boolean;
}

/**
 * Find the account's "<Company> — targets" sheet, or create it in the account
 * folder. `driveId` is the Shared Drive id (needed to scope the lookup).
 */
export async function findOrCreateTargetsSheet(
  token: string,
  driveId: string,
  accountFolderId: string,
  accountName: string,
): Promise<TargetsSheet> {
  const name = `${accountName} — targets`;
  const q =
    `'${accountFolderId}' in parents and name = '${name.replace(/'/g, "\\'")}' ` +
    `and mimeType = '${SHEET_MIME}' and trashed = false`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,webViewLink)",
    corpora: "drive",
    driveId,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    pageSize: "1",
  });
  const found = (await google(`${DRIVE}/files?${params.toString()}`, token)) as {
    files?: { id: string; webViewLink?: string }[];
  };
  const existing = found.files?.[0];
  if (existing) {
    return { id: existing.id, url: existing.webViewLink ?? sheetUrl(existing.id), created: false };
  }

  const created = (await google(
    `${DRIVE}/files?supportsAllDrives=true&fields=id,webViewLink`,
    token,
    { method: "POST", body: JSON.stringify({ name, mimeType: SHEET_MIME, parents: [accountFolderId] }) },
  )) as { id: string; webViewLink?: string };
  return { id: created.id, url: created.webViewLink ?? sheetUrl(created.id), created: true };
}

function sheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/** Write the run status into A1:B1 (e.g. "Running…", "Done — 8 contacts", "Failed: …"). */
export async function writeStatus(token: string, sheetId: string, status: string): Promise<void> {
  await google(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent("A1:B1")}?valueInputOption=RAW`,
    token,
    { method: "PUT", body: JSON.stringify({ values: [["Status", status]] }) },
  );
}

/**
 * Replace the contacts area with the latest results: clears the old rows, then
 * writes the header at row 3 and the contacts below it. Status row (1) is left
 * intact.
 */
export async function writeContacts(
  token: string,
  sheetId: string,
  contacts: FoundContact[],
): Promise<void> {
  // Clear any prior contacts so a re-run doesn't leave stale rows behind.
  await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent("A3:F1000")}:clear`, token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  const rows = contacts.map((c) => [
    c.name,
    c.title,
    c.company,
    c.email ?? "",
    c.linkedin ?? "",
    c.rationale,
  ]);
  await google(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent("A3")}?valueInputOption=RAW`,
    token,
    { method: "PUT", body: JSON.stringify({ values: [HEADER, ...rows] }) },
  );
}
