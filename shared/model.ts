/**
 * The data model — one place that declares the record types and how each Drive
 * subfolder maps to them. Nothing else in the codebase should know folder names
 * or column order; import from here.
 *
 * Columns mirror the header rows created in the shared Drive (LAB-6). Every
 * field except `id` is optional: Drive is edited by humans, so treat any cell as
 * possibly blank.
 */

export interface Account {
  id: string;
  name?: string;
  website?: string;
  stage?: string;
  one_liner?: string;
  status?: string;
  owner?: string;
}

export interface Contact {
  id: string;
  account_id?: string;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  status?: string;
  notes?: string;
}

export interface Lead {
  id: string;
  company?: string;
  sector?: string;
  stage?: string;
  rank?: string;
  rationale?: string;
  status?: string;
}

export type RecordKind = "accounts" | "contacts" | "leads";

export interface FolderSpec {
  kind: RecordKind;
  /** The subfolder name inside the shared Drive top folder. */
  folderName: string;
  /** Expected header columns, in the canonical order. Order in Drive may differ. */
  columns: string[];
}

export const FOLDERS: Record<RecordKind, FolderSpec> = {
  accounts: {
    kind: "accounts",
    folderName: "Accounts",
    columns: ["id", "name", "website", "stage", "one_liner", "status", "owner"],
  },
  contacts: {
    kind: "contacts",
    folderName: "Contacts",
    columns: ["id", "account_id", "name", "title", "company", "email", "status", "notes"],
  },
  leads: {
    kind: "leads",
    folderName: "Leads",
    columns: ["id", "company", "sector", "stage", "rank", "rationale", "status"],
  },
};
