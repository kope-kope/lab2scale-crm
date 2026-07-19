import type { FoundContact } from "./findContacts.js";
import type { FoundCompany } from "./findCompanies.js";

/**
 * Server-side Google Drive + Sheets writes for the async finder, done as the
 * signed-in user. Each account gets two sheets in its Drive folder:
 *
 *   "<Company> — companies"  Stage 1 output; a human marks the Approve column.
 *   "<Company> — contacts"   Stage 2 output; people at the approved companies.
 *
 * Both carry a run-status row (A1:B1) so a background run reports Running →
 * Done / Failed without the browser waiting.
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

const COMPANY_HEADER = ["Company", "Rationale", "Tier", "Approve? (type yes)"];
const CONTACT_HEADER = ["Name", "Title", "Company", "Email", "LinkedIn", "Rationale"];
const APPROVED = new Set(["yes", "y", "approved", "true", "✓", "x"]);

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

export interface Sheet {
  id: string;
  url: string;
  created: boolean;
}

function sheetUrl(id: string): string {
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

/** Find a sheet by exact name in the account folder, or create it there. */
export async function findOrCreateSheet(
  token: string,
  driveId: string,
  accountFolderId: string,
  name: string,
): Promise<Sheet> {
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
  const created = (await google(`${DRIVE}/files?supportsAllDrives=true&fields=id,webViewLink`, token, {
    method: "POST",
    body: JSON.stringify({ name, mimeType: SHEET_MIME, parents: [accountFolderId] }),
  })) as { id: string; webViewLink?: string };
  return { id: created.id, url: created.webViewLink ?? sheetUrl(created.id), created: true };
}

export function companiesSheetName(accountName: string): string {
  return `${accountName} — companies`;
}
export function contactsSheetName(accountName: string): string {
  return `${accountName} — contacts`;
}

/** Write the run status into A1:B1 (Running… / Done / Failed). */
export async function writeStatus(token: string, sheetId: string, status: string): Promise<void> {
  await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent("A1:B1")}?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ values: [["Run", status]] }),
  });
}

async function readValues(token: string, sheetId: string, range: string): Promise<string[][]> {
  const data = (await google(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent(range)}`,
    token,
  )) as { values?: string[][] };
  return data.values ?? [];
}

async function clearAndWrite(
  token: string,
  sheetId: string,
  clearRange: string,
  header: string[],
  rows: string[][],
): Promise<void> {
  await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent(clearRange)}:clear`, token, {
    method: "POST",
    body: JSON.stringify({}),
  });
  await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent("A3")}?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ values: [header, ...rows] }),
  });
}

/** Ensure the company header sits at row 3 (first run creates it). */
async function ensureCompanyHeader(token: string, sheetId: string): Promise<void> {
  const head = await readValues(token, sheetId, "A3:D3");
  const present = (head[0]?.[0] ?? "").toString().trim().toLowerCase().includes("company");
  if (!present) {
    await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent("A3")}?valueInputOption=RAW`, token, {
      method: "PUT",
      body: JSON.stringify({ values: [COMPANY_HEADER] }),
    });
  }
}

/**
 * Stage 1: APPEND companies (new search adds to the list, never replaces). This
 * preserves existing rows and their Approve marks. Dedup is handled upstream.
 */
export async function appendCompanies(
  token: string,
  sheetId: string,
  companies: FoundCompany[],
): Promise<void> {
  await ensureCompanyHeader(token, sheetId);
  if (!companies.length) return;
  const rows = companies.map((c) => [c.company, c.rationale, c.tier ?? "", ""]);
  await google(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent("A3")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    token,
    { method: "POST", body: JSON.stringify({ values: rows }) },
  );
}

function readCompanyColumn(rows: string[][], filter?: (approve: string) => boolean): string[] {
  if (rows.length < 2) return [];
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const companyCol = header.findIndex((h) => h.includes("company"));
  const approveCol = header.findIndex((h) => h.includes("approve"));
  if (companyCol < 0) return [];
  const out: string[] = [];
  for (const row of rows.slice(1)) {
    const company = (row[companyCol] ?? "").trim();
    if (!company) continue;
    if (filter) {
      const approve = approveCol >= 0 ? (row[approveCol] ?? "").trim().toLowerCase() : "";
      if (!filter(approve)) continue;
    }
    out.push(company);
  }
  return out;
}

/** Every company already on the sheet (any approval state) — used for dedup. */
export async function readAllCompanies(token: string, sheetId: string): Promise<string[]> {
  return readCompanyColumn(await readValues(token, sheetId, "A3:D1000"));
}

/** Read the companies sheet and return the companies whose Approve cell is set. */
export async function readApprovedCompanies(token: string, sheetId: string): Promise<string[]> {
  return readCompanyColumn(await readValues(token, sheetId, "A3:D1000"), (a) => APPROVED.has(a));
}

/** Stage 2: write the found contacts (replacing any prior rows). */
export async function writeContacts(
  token: string,
  sheetId: string,
  contacts: FoundContact[],
): Promise<void> {
  const rows = contacts.map((c) => [
    c.name,
    c.title,
    c.company,
    c.email ?? "",
    c.linkedin ?? "",
    c.rationale,
  ]);
  await clearAndWrite(token, sheetId, "A3:F1000", CONTACT_HEADER, rows);
}
