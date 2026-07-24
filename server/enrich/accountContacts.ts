/**
 * Server-side access to an account's finder contacts sheet ("<Account> —
 * contacts"), as the signed-in user. That sheet is where the AI finder writes
 * people it discovers; its header sits at row 3 (Name, Title, Company, Email,
 * LinkedIn, Rationale) and data begins at row 4. This reads the rows and writes
 * found emails back into the Email column, filling empty cells only.
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

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
    const msg = `Google API ${res.status}.${reasonFrom(await res.text().catch(() => ""))}`;
    // eslint-disable-next-line no-console
    console.error(`[drive] ${init?.method ?? "GET"} ${url.split("?")[0]} → ${msg}`);
    throw new Error(msg);
  }
  return res.json();
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

export interface AccountContactsSheet {
  sheetId: string;
  sheetUrl: string;
  /** Header row (sheet row 3). */
  headers: string[];
  /** Data rows (from sheet row 4 down). */
  rows: string[][];
  /** Sheet row number of the first data row (4). */
  firstDataRow: number;
}

/**
 * Find the account's "<Account> — contacts" sheet and read its grid. Returns
 * null when the sheet doesn't exist yet (the finder hasn't run).
 */
export async function readAccountContacts(
  token: string,
  driveId: string,
  accountFolderId: string,
  accountName: string,
): Promise<AccountContactsSheet | null> {
  const name = `${accountName} — contacts`;
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
  const sheet = found.files?.[0];
  if (!sheet) return null;

  const data = (await google(
    `${SHEETS}/${sheet.id}/values/${encodeURIComponent("A3:Z2000")}`,
    token,
  )) as { values?: string[][] };
  const values = data.values ?? [];
  return {
    sheetId: sheet.id,
    sheetUrl: sheet.webViewLink ?? `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
    headers: (values[0] ?? []).map((h) => String(h).trim()),
    rows: values.slice(1),
    firstDataRow: 4,
  };
}

export function headerIndex(headers: string[], names: string[]): number {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return headers.findIndex((h) => wanted.has(h.trim().toLowerCase()));
}

/** Write emails into the Email column at the given sheet row numbers. */
export async function writeContactEmails(
  token: string,
  sheetId: string,
  emailColIndex: number,
  updates: { rowNumber: number; email: string }[],
): Promise<number> {
  const col = colLetter(emailColIndex);
  let written = 0;
  for (const u of updates) {
    await google(
      `${SHEETS}/${sheetId}/values/${encodeURIComponent(`${col}${u.rowNumber}`)}?valueInputOption=RAW`,
      token,
      { method: "PUT", body: JSON.stringify({ values: [[u.email]] }) },
    );
    written++;
  }
  return written;
}
