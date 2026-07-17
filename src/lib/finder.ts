/** Client for the AI contact finder endpoint (server-side Claude, LAB-22). */

export interface FoundContact {
  name: string;
  title: string;
  company: string;
  email?: string;
  linkedin?: string;
  rationale: string;
}

export interface FinderResult {
  contacts: FoundContact[];
  /** Present when the finder returned prose instead of a contact list. */
  note?: string;
}

/**
 * Ask the server to find contacts for an account, driven by its context doc.
 * The Anthropic key lives server-side; we only send the account name and the
 * context text plus our Google token so the server can check the domain.
 */
export async function findContacts(
  token: string,
  accountName: string,
  contextText: string,
): Promise<FinderResult> {
  const res = await fetch("/api/find-contacts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ accountName, contextText }),
  });
  const data = (await res.json().catch(() => ({}))) as FinderResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `The finder failed (${res.status}).`);
  }
  return { contacts: data.contacts ?? [], note: data.note };
}
