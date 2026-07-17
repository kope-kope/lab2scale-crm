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

// --- Write-back (additive only — never deletes or overwrites) --------------

const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";

async function createFolder(token: string, parentId: string, name: string): Promise<DriveFile> {
  const res = await fetch(`${DRIVE}/files?supportsAllDrives=true&fields=id,name,mimeType`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Couldn't create the folder (${res.status}).${detail}`);
  }
  return res.json() as Promise<DriveFile>;
}

/** Create a company folder inside Accounts/ (or Leads/). Returns the new folder.
 *  For accounts, also seeds a context doc inside it (LAB-21). */
export async function createCompanyFolder(
  token: string,
  topFolderId: string,
  area: "accounts" | "leads",
  name: string,
): Promise<DriveFile> {
  const areaName = area === "accounts" ? AREA_FOLDERS.accounts : AREA_FOLDERS.leads;
  const areaFolder = await findFolder(token, topFolderId, topFolderId, areaName);
  if (!areaFolder) throw new Error(`The ${areaName} folder isn't in Drive.`);
  const folder = await createFolder(token, areaFolder.id, name.trim());
  if (area === "accounts") {
    await createContextDoc(token, folder.id, name.trim());
  }
  return folder;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The seeded context-doc template (LAB-21). Sentence case, per the design voice. */
export const CONTEXT_DOC_PREFIX = "Context —";

function contextDocHtml(company: string): string {
  const c = escapeHtml(company);
  return [
    `<h1>${c} — account context</h1>`,
    `<p>A living space to capture how we're approaching this account. Edit freely.</p>`,
    `<h2>Strategy for finding contacts</h2>`,
    `<p>How we plan to source and reach the right people at this account.</p>`,
    `<h2>Account background / overview</h2>`,
    `<p>What the company does, and why it's a fit for the client.</p>`,
    `<h2>Ideal contact profile</h2>`,
    `<p>Titles, roles, and personas to target.</p>`,
    `<h2>Outreach angle / positioning</h2>`,
    `<p>The pitch or hook for this account.</p>`,
    `<h2>Notes &amp; learnings</h2>`,
    `<p>A running log of what's worked, blockers, and context.</p>`,
  ].join("");
}

/**
 * Create a formatted Google Doc inside the account folder, seeded from the
 * template. Uploads HTML via a multipart Drive create and lets Drive convert it
 * to a Doc — no separate Docs API scope needed.
 */
export async function createContextDoc(
  token: string,
  accountFolderId: string,
  company: string,
): Promise<DriveFile> {
  const boundary = `l2s-${Date.now()}`;
  const metadata = {
    name: `${CONTEXT_DOC_PREFIX} ${company}`,
    mimeType: "application/vnd.google-apps.document",
    parents: [accountFolderId],
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n\r\n` +
    `${contextDocHtml(company)}\r\n` +
    `--${boundary}--`;
  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Account created, but the context doc failed (${res.status}).${detail}`);
  }
  return res.json() as Promise<DriveFile>;
}

/** Locate the Contacts sheet and read its header row (so appends map correctly). */
async function contactsSheet(
  token: string,
  topFolderId: string,
): Promise<{ id: string; headers: string[] }> {
  const area = await findFolder(token, topFolderId, topFolderId, AREA_FOLDERS.contacts);
  if (!area) throw new Error("The Contacts folder isn't in Drive.");
  const sheet = (await listChildren(token, topFolderId, area.id, SHEET_MIME))[0];
  if (!sheet) throw new Error("No spreadsheet inside the Contacts folder.");
  const res = await fetch(`${SHEETS}/${sheet.id}/values/A1:1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Couldn't read the Contacts sheet header (${res.status}).${detail}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return { id: sheet.id, headers: (data.values?.[0] ?? []).map((h) => String(h)) };
}

export interface NewContact {
  name: string;
  company?: string;
  email?: string;
  title?: string;
}

/** Append a contact row, mapped to whatever headers the sheet actually has. */
export async function appendContact(
  token: string,
  topFolderId: string,
  contact: NewContact,
  idFactory: () => string,
): Promise<void> {
  const { id: sheetId, headers } = await contactsSheet(token, topFolderId);
  // Fill both `account` and `account_id` with the company so linking works
  // regardless of which the sheet uses.
  const byHeader: Record<string, string> = {
    id: idFactory(),
    name: contact.name,
    title: contact.title ?? "",
    company: contact.company ?? "",
    account: contact.company ?? "",
    account_id: contact.company ?? "",
    email: contact.email ?? "",
    status: "new",
    notes: "",
  };
  const row = headers.map((h) => byHeader[h.trim().toLowerCase()] ?? "");
  const res = await fetch(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent("A1")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values: [row] }),
    },
  );
  if (!res.ok) {
    const detail = reasonFrom(await res.text().catch(() => ""));
    throw new Error(`Couldn't add the contact (${res.status}).${detail}`);
  }
}
