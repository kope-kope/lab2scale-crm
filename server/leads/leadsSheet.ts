/**
 * Server-side Drive + Sheets access for the Leads qualifier, as the signed-in
 * user. Reads the Leads sheet, finds/seeds the qualification-rules doc, and
 * writes each lead's verdict (Status + a reason column) back in place.
 */

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const DOC_MIME = "application/vnd.google-apps.document";

const LEADS_FOLDER = "Leads";
const RULES_DOC_NAME = "Lead qualification rules";
export const NOTE_HEADER = "Screen";

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

async function listChildren(
  token: string,
  driveId: string,
  parentId: string,
  mimeType?: string,
): Promise<{ id: string; name: string; webViewLink?: string }[]> {
  let q = `'${parentId}' in parents and trashed = false`;
  if (mimeType) q += ` and mimeType = '${mimeType}'`;
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

export interface LeadsSheet {
  sheetId: string;
  sheetUrl: string;
  folderId: string;
}

/** Locate the Leads area folder and the leads spreadsheet inside it. */
export async function findLeadsSheet(
  token: string,
  driveId: string,
  topFolderId: string,
): Promise<LeadsSheet> {
  const folder = (await listChildren(token, driveId, topFolderId, FOLDER_MIME)).find(
    (f) => f.name === LEADS_FOLDER,
  );
  if (!folder) throw new Error("The Leads folder isn't in Drive.");
  const sheet = (await listChildren(token, driveId, folder.id, SHEET_MIME))[0];
  if (!sheet) throw new Error("No spreadsheet inside the Leads folder.");
  return {
    sheetId: sheet.id,
    sheetUrl: sheet.webViewLink ?? `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
    folderId: folder.id,
  };
}

export interface LeadGrid {
  headers: string[];
  rows: string[][];
}

/** Read the whole leads grid (row 0 = headers). */
export async function readLeadGrid(token: string, sheetId: string): Promise<LeadGrid> {
  const data = (await google(
    `${SHEETS}/${sheetId}/values/${encodeURIComponent("A1:Z2000")}`,
    token,
  )) as { values?: string[][] };
  const values = data.values ?? [];
  return { headers: (values[0] ?? []).map((h) => String(h).trim()), rows: values.slice(1) };
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

function headerIndex(headers: string[], names: string[]): number {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  return headers.findIndex((h) => wanted.has(h.trim().toLowerCase()));
}

async function update(token: string, sheetId: string, range: string, values: string[][]): Promise<void> {
  await google(`${SHEETS}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, token, {
    method: "PUT",
    body: JSON.stringify({ values }),
  });
}

export interface Verdict {
  index: number;
  company: string;
  decision: string;
  reason: string;
}

/**
 * Write verdicts back into the sheet: the Status column becomes Qualified /
 * Disqualified, and the reason goes into a "Qualification note" column (created
 * if absent). Verdicts are matched to rows by index, falling back to company.
 */
export async function writeVerdicts(
  token: string,
  sheetId: string,
  grid: LeadGrid,
  verdicts: Verdict[],
): Promise<void> {
  const { headers, rows } = grid;
  const companyIdx = headerIndex(headers, ["company", "name"]);
  let statusIdx = headerIndex(headers, ["status"]);
  let noteIdx = headerIndex(headers, ["screen", "qualification note", "note", "reason"]);

  // Append Status / note headers if the sheet doesn't have them.
  let nextCol = headers.length;
  if (statusIdx < 0) {
    statusIdx = nextCol++;
    await update(token, sheetId, `${colLetter(statusIdx)}1`, [["Status"]]);
  }
  if (noteIdx < 0) {
    noteIdx = nextCol++;
    await update(token, sheetId, `${colLetter(noteIdx)}1`, [[NOTE_HEADER]]);
  }

  const byIndex = new Map<number, Verdict>();
  const byCompany = new Map<string, Verdict>();
  for (const v of verdicts) {
    byIndex.set(v.index, v);
    byCompany.set(v.company.trim().toLowerCase(), v);
  }

  const statusCol: string[][] = [];
  const noteCol: string[][] = [];
  rows.forEach((row, i) => {
    const company = (row[companyIdx] ?? "").trim();
    const v = byIndex.get(i) ?? byCompany.get(company.toLowerCase());
    statusCol.push([v ? v.decision : (row[statusIdx] ?? "")]);
    noteCol.push([v ? v.reason : (row[noteIdx] ?? "")]);
  });

  const last = rows.length + 1; // data starts at sheet row 2
  if (rows.length) {
    await update(token, sheetId, `${colLetter(statusIdx)}2:${colLetter(statusIdx)}${last}`, statusCol);
    await update(token, sheetId, `${colLetter(noteIdx)}2:${colLetter(noteIdx)}${last}`, noteCol);
  }
}

/**
 * Resolve which data-row (0-based, header excluded) a lead is, matching by the
 * client's index when the company still lines up, else by company name. Returns
 * -1 if the sheet no longer has that lead.
 */
export function resolveDataRow(grid: LeadGrid, company: string, rowIndex: number): number {
  const ci = headerIndex(grid.headers, ["company", "name"]);
  if (ci < 0) return -1;
  const target = company.trim().toLowerCase();
  if (
    rowIndex >= 0 &&
    rowIndex < grid.rows.length &&
    (grid.rows[rowIndex][ci] ?? "").trim().toLowerCase() === target
  ) {
    return rowIndex;
  }
  return grid.rows.findIndex((r) => (r[ci] ?? "").trim().toLowerCase() === target);
}

/** The gid of the first tab (needed for row deletion). */
export async function firstSheetGid(token: string, sheetId: string): Promise<number> {
  const data = (await google(`${SHEETS}/${sheetId}?fields=sheets.properties(sheetId,index)`, token)) as {
    sheets?: { properties?: { sheetId?: number; index?: number } }[];
  };
  const first = (data.sheets ?? [])
    .slice()
    .sort((a, b) => (a.properties?.index ?? 0) - (b.properties?.index ?? 0))[0];
  return first?.properties?.sheetId ?? 0;
}

/** Delete one data row from the sheet (dataIndex is 0-based, header excluded). */
export async function deleteRow(
  token: string,
  sheetId: string,
  gid: number,
  dataIndex: number,
): Promise<void> {
  await google(`${SHEETS}/${sheetId}:batchUpdate`, token, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: { sheetId: gid, dimension: "ROWS", startIndex: dataIndex + 1, endIndex: dataIndex + 2 },
          },
        },
      ],
    }),
  });
}

function defaultRulesHtml(): string {
  return [
    "<h1>Lab2Scale calibration notes</h1>",
    "<p>The deal-screen logic (mandate → dominant risk → proof → five-risk read → verdict) is built",
    "into the screener. Add Lab2Scale-specific calibration here — it's applied on top of the screen.</p>",
    "<h2>Mandate reminder</h2>",
    "<p>Hardware deep-tech only: semiconductors, power &amp; energy generation, water generation,",
    "storage &amp; batteries, and adjacent hard tech. Pure software / SaaS / consumer / fintech is a",
    "fast Pass on mandate.</p>",
    "<h2>Bar / calibration</h2>",
    "<ul>",
    "<li>Prefer demonstrated technology (roughly TRL 4+); pure concept-stage usually Gates at best.</li>",
    "<li>Weigh the internal relevance score, but the two calls (dominant risk, proof) decide the verdict.</li>",
    "<li>Add named past decisions here over time so the screener calibrates to the real Lab2Scale bar.</li>",
    "</ul>",
  ].join("");
}

/** Find the rules doc in the Leads folder, or create it seeded with defaults. Returns its text. */
export async function findOrCreateRulesDoc(
  token: string,
  driveId: string,
  leadsFolderId: string,
): Promise<{ text: string; url: string; created: boolean }> {
  const docs = await listChildren(token, driveId, leadsFolderId, DOC_MIME);
  const existing = docs.find((d) => /qualif|rules/i.test(d.name));
  if (existing) {
    const res = await fetch(
      `${DRIVE}/files/${existing.id}/export?mimeType=${encodeURIComponent("text/plain")}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const text = res.ok ? (await res.text()).trim() : "";
    if (text.length > 20) {
      return { text, url: existing.webViewLink ?? "", created: false };
    }
  }

  const boundary = `l2s-rules-${leadsFolderId.length}`;
  const metadata = { name: RULES_DOC_NAME, mimeType: DOC_MIME, parents: [leadsFolderId] };
  const html = defaultRulesHtml();
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n${html}\r\n--${boundary}--`;
  const res = await fetch(
    `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Couldn't create the rules doc (${res.status}).`);
  const doc = (await res.json()) as { id: string; webViewLink?: string };
  const exported = await fetch(
    `${DRIVE}/files/${doc.id}/export?mimeType=${encodeURIComponent("text/plain")}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return { text: exported.ok ? (await exported.text()).trim() : "", url: doc.webViewLink ?? "", created: true };
}
