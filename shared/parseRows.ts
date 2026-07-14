import { CONTACT_COLUMNS, type Contact } from "./model.ts";

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
