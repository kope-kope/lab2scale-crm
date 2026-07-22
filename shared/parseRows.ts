import { CONTACT_COLUMNS, type Contact, type Lead } from "./model.ts";

/**
 * Turns a raw sheet value grid (Sheets `values`: row 0 = headers, rest = data)
 * into records, keyed by **header name** so columns can be reordered or have
 * extras. Blank rows and rows without an id are dropped; cells are trimmed.
 *
 * Only Contacts are sheet-backed now (Accounts/Leads are folders), so the one
 * typed helper here is toContacts.
 */
export type RawRow = Record<string, string>;

export function parseSheet(values: readonly (readonly string[])[]): RawRow[] {
  if (!values || values.length < 1) return [];
  const headers = (values[0] ?? []).map((h) => (h ?? "").trim());
  return values
    .slice(1)
    .filter((row) => row.some((cell) => (cell ?? "").trim() !== ""))
    .map((row) => {
      const obj: RawRow = {};
      headers.forEach((key, i) => {
        if (key) obj[key] = (row[i] ?? "").trim();
      });
      return obj;
    });
}

function shape<T>(row: RawRow, columns: string[]): T {
  const out: RawRow = {};
  for (const col of columns) {
    if (row[col] !== undefined && row[col] !== "") out[col] = row[col];
  }
  return out as unknown as T;
}

export function toContacts(values: readonly (readonly string[])[]): Contact[] {
  return parseSheet(values)
    .filter((row) => (row.id ?? "") !== "")
    .map((row) => shape<Contact>(row, CONTACT_COLUMNS));
}

/** Look up a row value by any of several header names (case-insensitive). */
function pick(row: RawRow, names: string[]): string | undefined {
  const wanted = new Set(names.map((n) => n.toLowerCase()));
  for (const key of Object.keys(row)) {
    if (wanted.has(key.trim().toLowerCase())) {
      const v = row[key];
      if (v) return v;
    }
  }
  return undefined;
}

/** Parse the Leads sheet. Headers may vary in case/spacing, so map tolerantly. */
export function toLeads(values: readonly (readonly string[])[]): Lead[] {
  return parseSheet(values)
    .map((row) => ({
      company: pick(row, ["company", "name"]) ?? "",
      sector: pick(row, ["sector", "category"]),
      stage: pick(row, ["stage", "trl"]),
      whyItFits: pick(row, ["why it fits", "why fits", "why", "rationale"]),
      contacts: pick(row, ["contacts", "contact"]),
      sourceUrl: pick(row, ["source url", "source", "url", "link"]),
      relevance: pick(row, ["relevance", "score"]),
      status: pick(row, ["status"]),
      note: pick(row, ["qualification note", "note", "reason"]),
    }))
    .filter((l) => l.company);
}
