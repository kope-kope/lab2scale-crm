import { parseCsv } from "@shared/csv";
import { toAccounts, toContacts, toLeads } from "@shared/parseRows";
import { FOLDERS } from "@shared/model";
import type { Account, Contact, Lead } from "@shared/model";

/**
 * Reads the Accounts/Contacts/Leads records from the shared Drive folder, as the
 * signed-in user (their access token). The data lives in a Shared Drive, so every
 * call sets supportsAllDrives / includeItemsFromAllDrives.
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

async function driveJson(path: string, token: string): Promise<{ files?: DriveFile[] }> {
  const res = await fetch(`${DRIVE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Your session expired — sign in again.");
    throw new Error(`Couldn't reach Google Drive (${res.status}).`);
  }
  return res.json();
}

async function listChildren(token: string, parentId: string, mimeType?: string): Promise<DriveFile[]> {
  let q = `'${parentId}' in parents and trashed = false`;
  if (mimeType) q += ` and mimeType = '${mimeType}'`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,mimeType)",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    corpora: "allDrives",
    pageSize: "100",
  });
  const data = await driveJson(`/files?${params.toString()}`, token);
  return data.files ?? [];
}

async function exportCsv(token: string, fileId: string): Promise<string> {
  const res = await fetch(
    `${DRIVE}/files/${fileId}/export?mimeType=${encodeURIComponent("text/csv")}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Couldn't read a sheet (${res.status}).`);
  return res.text();
}

/** Read one subfolder (by name) → its sheet's value grid. Empty if missing. */
async function readGrid(token: string, topFolderId: string, folderName: string): Promise<string[][]> {
  const sub = (await listChildren(token, topFolderId, FOLDER_MIME)).find(
    (f) => f.name === folderName,
  );
  if (!sub) return [];
  const sheet = (await listChildren(token, sub.id, SHEET_MIME))[0];
  if (!sheet) return [];
  return parseCsv(await exportCsv(token, sheet.id));
}

export interface DriveData {
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
}

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
