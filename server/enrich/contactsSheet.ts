/**
 * Server-side access to the central Contacts sheet, as the signed-in user.
 * Reads the grid and writes found emails back into the `email` column, matching
 * rows by the contact `id` and only filling cells that are currently empty
 * (additive — never overwrites an email a human already entered).
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const CONTACTS_FOLDER = "Contacts";

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
  if (!res.ok) throw new Error(`Google API ${res.status}.${reasonFrom(await res.text().catch(() => ""))}`);
  return res.json();
}

async function listChildren(token: string, driveId: string, parentId: string, mimeType: string) {
  const q = `'${parentId}' in parents and trashed = false and mimeType = '${mimeType}'`;
  const params = new URLSearchParams({
    q,
    fields: "files(id,name,webViewLink)",
    corpora: "drive",
    driveId,
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    pageSize: "50",
    orderBy: "name",
  });
  return ((await google(`${DRIVE}/files?${params.toString()}`, token)) as {
    files?: { id: string; name: string; webViewLink?: string }[];
  }).files ?? [];
}

function colLetter(index: number): string {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export interface ContactsGrid {
  sheetId: string;
  sheetUrl: string;
  headers: string[];
  rows: string[][];
}

/** Locate the Contacts sheet and read its whole grid (row 0 = headers). */
export async function readContactsGrid(
  token: string,
  driveId: string,
  topFolderId: string,
): Promise<ContactsGrid> {
  const area = (await listChildren(token, driveId, topFolderId, FOLDER_MIME)).find(
    (f) => f.name === CONTACTS_FOLDER,
  );
  if (!area) throw new Error("The Contacts folder isn't in Drive.");
  const sheet = (await listChildren(token, driveId, area.id, SHEET_MIME))[0];
  if (!sheet) throw new Error("No spreadsheet inside the Contacts folder.");
  const data = (await google(
    `${SHEETS}/${sheet.id}/values/${encodeURIComponent("A1:Z5000")}`,
    token,
  )) as { values?: string[][] };
  const values = data.values ?? [];
  return {
    sheetId: sheet.id,
    sheetUrl: sheet.webViewLink ?? `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
    headers: (values[0] ?? []).map((h) => String(h).trim()),
    rows: values.slice(1),
  };
}

function headerIndex(headers: string[], names: string[]): number {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return headers.findIndex((h) => wanted.has(h.trim().toLowerCase()));
}

/** Public header→index lookup (case-insensitive), for callers reading the grid. */
export function columnIndex(headers: string[], names: string[]): number {
  return headerIndex(headers, names);
}

/**
 * Write emails back into the sheet's email column, keyed by contact id. Only
 * fills rows whose email cell is currently empty. Returns how many were written.
 * Creates an "email" column if the sheet somehow lacks one.
 */
export async function writeEmails(
  token: string,
  grid: ContactsGrid,
  emailById: Map<string, string>,
): Promise<number> {
  const { sheetId, headers, rows } = grid;
  const idIdx = headerIndex(headers, ["id"]);
  if (idIdx < 0) throw new Error("The Contacts sheet has no id column to match on.");

  let emailIdx = headerIndex(headers, ["email"]);
  if (emailIdx < 0) {
    emailIdx = headers.length;
    await update(token, sheetId, `${colLetter(emailIdx)}1`, [["email"]]);
  }

  const col = colLetter(emailIdx);
  let written = 0;
  // One targeted cell update per filled row — simpler and safe against other
  // columns than a full-column rewrite, and the batches here are small.
  for (let i = 0; i < rows.length; i++) {
    const id = (rows[i][idIdx] ?? "").trim();
    const found = emailById.get(id);
    const current = (rows[i][emailIdx] ?? "").trim();
    if (found && !current) {
      await update(token, sheetId, `${col}${i + 2}`, [[found]]); // +2: header + 1-based
      written++;
    }
  }
  return written;
}

async function update(token: string, sheetId: string, range: string, values: string[][]): Promise<void> {
  await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}
