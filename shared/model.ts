/**
 * The data model. Two shapes of record:
 *  - Accounts and Leads are **folder-backed**: each company is a subfolder inside
 *    the `Accounts` / `Leads` folder. The record is the folder (id + name).
 *  - Contacts are **sheet-backed**: one Google Sheet of rows, linked to an account
 *    by the company/account name.
 *
 * Nothing else in the codebase should know folder names or column order.
 */

/** A company folder inside Accounts/. */
export interface Account {
  id: string; // Drive folder id
  name: string; // company name (folder name)
}

/** A company folder inside Leads/. */
export interface Lead {
  id: string; // Drive folder id
  name: string; // company name (folder name)
}

/** A row in the Contacts sheet. `account` links to an Account by company name. */
export interface Contact {
  id: string;
  account?: string;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  status?: string;
  notes?: string;
}

/** Top-level folder names inside the shared Drive. */
export const AREA_FOLDERS = {
  accounts: "Accounts",
  contacts: "Contacts",
  leads: "Leads",
} as const;

/** Columns the Contacts sheet is read against (by header name; extras ignored). */
export const CONTACT_COLUMNS = [
  "id",
  "account",
  "name",
  "title",
  "company",
  "email",
  "status",
  "notes",
];
