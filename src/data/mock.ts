/**
 * Placeholder data so the UI is real to look at before the Google Sheets data
 * layer is wired (Phase 1). Shapes mirror the `Accounts` tab schema in CLAUDE.md.
 * Replace this module with the typed Sheets read layer — nothing else should
 * import mock data.
 */
export type AccountStatus = "active" | "onboarding" | "paused";

export interface Account {
  id: string;
  name: string;
  website: string;
  stage: string;
  one_liner: string;
  status: AccountStatus;
  owner: string;
  contacts: number;
}

export const MOCK_ACCOUNTS: Account[] = [
  {
    id: "apollo-atomics",
    name: "Apollo Atomics",
    website: "apolloatomics.com",
    stage: "Signed",
    one_liner: "Compact fission systems for industrial heat and power.",
    status: "active",
    owner: "Amos",
    contacts: 0,
  },
];
