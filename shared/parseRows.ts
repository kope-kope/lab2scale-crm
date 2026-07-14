import {
  FOLDERS,
  type Account,
  type Contact,
  type Lead,
  type RecordKind,
} from "./model.ts";

/**
 * Turns a raw sheet value grid (the Sheets API's `values`: first row = headers,
 * the rest = data) into typed records. Keyed by **header name**, so columns can
 * be reordered or have extras; unknown columns are dropped from the typed shape,
 * blank rows are ignored, and rows without an `id` are skipped (a record with no
 * id is noise, not data).
 */
export type RawRow = Record<string, string>;

/** Header-keyed rows, tolerant of blanks. Keeps every column present in the sheet. */
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

/** Keep only the columns the record type knows about, and require a non-empty id. */
function shapeRecords<T>(kind: RecordKind, values: readonly (readonly string[])[]): T[] {
  const columns = FOLDERS[kind].columns;
  return parseSheet(values)
    .filter((row) => (row.id ?? "") !== "")
    .map((row) => {
      const shaped: RawRow = {};
      for (const col of columns) {
        if (row[col] !== undefined && row[col] !== "") shaped[col] = row[col];
      }
      return shaped as unknown as T;
    });
}

export const toAccounts = (values: readonly (readonly string[])[]): Account[] =>
  shapeRecords<Account>("accounts", values);

export const toContacts = (values: readonly (readonly string[])[]): Contact[] =>
  shapeRecords<Contact>("contacts", values);

export const toLeads = (values: readonly (readonly string[])[]): Lead[] =>
  shapeRecords<Lead>("leads", values);
