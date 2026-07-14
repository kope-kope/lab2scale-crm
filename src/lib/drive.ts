import { parseCsv } from "@shared/csv";
import { toAccounts, toContacts, toLeads } from "@shared/parseRows";
import { FOLDERS } from "@shared/model";
import type { Account, Contact, Lead } from "@shared/model";

/**
 * Reads the Accounts/Contacts/Leads records from the shared Drive folder, as the
 * signed-in user (their access token).
 *
 * The data lives in a Shared Drive, so queries must scope to that drive with
 * corpora=drive + driveId (plus supportsAllDrives / includeItemsFromAllDrives).
 * Using corpora=allDrives here returns 404. driveId is the Shared Drive's id,
 * which equals the top-folder id we were given.
 *
 * Each subfolder holds one Google Sheet; we export it as CSV (drive.readonly
 * permits export — no separate Sheets scope needed) and parse it into records.
 */
const DRIVE = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

/** Pull a human-readable reason out of a Google API error body, if present. */
function reasonFrom(body: string): string {
  try {
    const j = JSON.parse(body) as { error?: { message?: string } };
    return j.error?.message ? ` ${j.error.message}` : "";
  } catch {
    return "";
  }
}

async function driveFetch(path: string, token: string): Promise<Response> {
  return fetch(`${DRIVE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function listChildren(
  token: string,
  driveId: string,
  parentId: string,
  mimeType?: string,
): Promise<DriveFile[]> {
  let q = `'${parentId}' in parents and trashed = false`;
  if (mimeType) q += ` and mimeType = '${mimeType}'`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType)",
    corpora: "drive",
    driveId,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    pageSize: "100",
  });
  const res = await driveFetch(`/files?${params.toString()}`, token);
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    if (res.status === 401) throw new Error("Your session expired — sign in again.");
    throw new Error(`Couldn't reach Google Drive (${res.status}).${detail}`);
  }
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

async function exportCsv(token: string, fileId: string): Promise<string> {
  const res = await driveFetch(
    `/files/${fileId}/export?mimeType=${encodeURIComponent("text/csv")}`,
    token,
  );
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Couldn't read a sheet (${res.status}).${detail}`);
  }
  return res.text();
}

/** Read one subfolder (by name) → its sheet's value grid. Empty if missing. */
async function readGrid(token: string, driveId: string, folderName: string): Promise<string[][]> {
  const sub = (await listChildren(token, driveId, driveId, FOLDER_MIME)).find(
    (f) => f.name === folderName,
  );
  if (!sub) return [];
  const sheet = (await listChildren(token, driveId, sub.id, SHEET_MIME))[0];
  if (!sheet) return [];
  return parseCsv(await exportCsv(token, sheet.id));
}

export interface DriveData {
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
}

/** `topFolderId` is the Shared Drive id (also used as the driveId scope). */
export async function readAll(token: string, topFolderId: string): Promise<DriveData> {
  const [aGrid, cGrid, lGrid] = await Promise.all([
    readGrid(token, topFolderId, FOLDERS.accounts.folderName),
    readGrid(token, topFolderId, FOLDERS.contacts.folderName),
    readGrid(token, topFolderId, FOLDERS.leads.folderName),
  ]);
  return {
    accounts: toAccounts(aGrid),
    contacts: toContacts(cGrid),
    leads: toLeads(lGrid),
  };
}
