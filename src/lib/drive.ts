import { parseCsv } from "@shared/csv";
import { toContacts } from "@shared/parseRows";
import { AREA_FOLDERS } from "@shared/model";
import type { Account, Contact, Lead } from "@shared/model";

/**
 * Reads the CRM data from the shared Drive folder, as the signed-in user.
 *
 * Structure (per the "folder per company" model):
 *   <top>/Accounts/<Company>/...     each account is a company folder
 *   <top>/Leads/<Company>/...        each lead is a company folder
 *   <top>/Contacts/<a sheet>         contacts are rows in one sheet
 *
 * The top folder is a Shared Drive, so every query scopes with corpora=drive +
 * driveId (== the top-folder id) plus supportsAllDrives/includeItemsFromAllDrives.
 */
const DRIVE = "https://www.googleapis.com/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
}

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

/** List children of a folder within the shared drive, optionally by mime type. */
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
    fields: "files(id,name,mimeType,webViewLink,modifiedTime)",
    corpora: "drive",
    driveId,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    orderBy: "name",
    pageSize: "200",
  });
  const res = await driveFetch(`/files?${params.toString()}`, token);
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    if (res.status === 401) throw new Error("Your session expired — sign in again.");
    throw new Error(`Couldn't reach Google Drive (${res.status}).${detail}`);
  }
  return ((await res.json()) as { files?: DriveFile[] }).files ?? [];
}

async function exportCsv(token: string, fileId: string): Promise<string> {
  const res = await driveFetch(
    `/files/${fileId}/export?mimeType=${encodeURIComponent("text/csv")}`,
    token,
  );
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Couldn't read the Contacts sheet (${res.status}).${detail}`);
  }
  return res.text();
}

async function findFolder(
  token: string,
  driveId: string,
  parentId: string,
  name: string,
): Promise<DriveFile | undefined> {
  return (await listChildren(token, driveId, parentId, FOLDER_MIME)).find((f) => f.name === name);
}

export interface DriveData {
  accounts: Account[];
  contacts: Contact[];
  leads: Lead[];
}

/** `topFolderId` is the Shared Drive id (also the driveId scope). */
export async function readAll(token: string, topFolderId: string): Promise<DriveData> {
  const [accountsArea, leadsArea, contactsArea] = await Promise.all([
    findFolder(token, topFolderId, topFolderId, AREA_FOLDERS.accounts),
    findFolder(token, topFolderId, topFolderId, AREA_FOLDERS.leads),
    findFolder(token, topFolderId, topFolderId, AREA_FOLDERS.contacts),
  ]);

  const [accountFolders, leadFolders, contacts] = await Promise.all([
    accountsArea ? listChildren(token, topFolderId, accountsArea.id, FOLDER_MIME) : Promise.resolve([]),
    leadsArea ? listChildren(token, topFolderId, leadsArea.id, FOLDER_MIME) : Promise.resolve([]),
    contactsArea ? readContacts(token, topFolderId, contactsArea.id) : Promise.resolve([]),
  ]);

  return {
    accounts: accountFolders.map((f) => ({ id: f.id, name: f.name })),
    leads: leadFolders.map((f) => ({ id: f.id, name: f.name })),
    contacts,
  };
}

/** Read the first spreadsheet inside the Contacts folder into typed contacts. */
async function readContacts(token: string, driveId: string, contactsFolderId: string): Promise<Contact[]> {
  const sheet = (await listChildren(token, driveId, contactsFolderId, SHEET_MIME))[0];
  if (!sheet) return [];
  return toContacts(parseCsv(await exportCsv(token, sheet.id)));
}

/** Files inside one account/lead company folder (for the detail screen). */
export async function listFolderFiles(
  token: string,
  driveId: string,
  folderId: string,
): Promise<DriveFile[]> {
  return listChildren(token, driveId, folderId);
}
