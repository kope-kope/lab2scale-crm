import { useState } from "react";
import { Sparkles, Users, Mail, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import {
  startFindCompanies,
  startFindContacts,
  findContactEmails,
  type FinderStarted,
  type ContactEmailsResult,
} from "@/lib/finder";

/**
 * The two-stage AI finder (LAB-25/26/27/30).
 *   Step 1 — find target companies → companies sheet (human marks "yes").
 *   Step 2 — find contacts at the approved companies → contacts sheet.
 * The server resolves the account's context itself: it uses the context doc if
 * one exists, or builds one from the account's documents first. Both stages run
 * in the background; we hand back the sheet link and let them fill in.
 */
export function FindContactsPanel({
  accountName,
  accountFolderId,
}: {
  accountName: string;
  accountFolderId: string;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState<null | "companies" | "contacts" | "emails">(null);
  const [result, setResult] = useState<(FinderStarted & { kind: "companies" | "contacts" }) | null>(null);
  const [emails, setEmails] = useState<(ContactEmailsResult & { done: true }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(kind: "companies" | "contacts") {
    if (!token) return;
    setBusy(kind);
    setError(null);
    try {
      const params = { accountName, accountFolderId };
      const res =
        kind === "companies"
          ? await startFindCompanies(token, params)
          : await startFindContacts(token, params);
      setResult({ ...res, kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the finder.");
    } finally {
      setBusy(null);
    }
  }

  async function goEmails() {
    if (!token) return;
    setBusy("emails");
    setError(null);
    setEmails(null);
    try {
      const res = await findContactEmails(token, { accountName, accountFolderId });
      setEmails({ ...res, done: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find emails.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Find contacts with AI">
      <p className="max-w-prose text-small text-muted">
        Two steps. First find target <strong>companies</strong> and mark the ones to pursue with{" "}
        <strong>“yes”</strong> in the sheet. Then find <strong>contacts</strong> at the approved
        companies. If this account has no context document yet, the AI builds one from its documents
        first. Both run in the background and write to a sheet.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => void go("companies")} disabled={busy !== null}>
          <Sparkles size={16} strokeWidth={1.5} />
          {busy === "companies" ? "Starting…" : "1 · Find target companies"}
        </Button>
        <Button variant="secondary" onClick={() => void go("contacts")} disabled={busy !== null}>
          <Users size={16} strokeWidth={1.5} />
          {busy === "contacts" ? "Starting…" : "2 · Find contacts for approved"}
        </Button>
        <Button variant="secondary" onClick={() => void goEmails()} disabled={busy !== null}>
          <Mail size={16} strokeWidth={1.5} />
          {busy === "emails" ? "Finding emails…" : "3 · Find emails"}
        </Button>
      </div>

      {error && <p className="mt-4 text-small text-danger-text">{error}</p>}

      {emails && (
        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <p className="text-small text-body">
            {(() => {
              const notFound = emails.results.filter((r) => r.outcome === "not_found").length;
              const errored = emails.results.filter((r) => r.outcome === "error").length;
              const parts = [`Found ${emails.found} email${emails.found === 1 ? "" : "s"}`];
              if (emails.written) parts.push(`wrote ${emails.written} to the sheet`);
              if (emails.skipped) parts.push(`${emails.skipped} already had one`);
              if (notFound) parts.push(`${notFound} not found`);
              if (errored) parts.push(`${errored} errored`);
              return `${parts.join(" · ")}. Checked ${emails.total} contact${emails.total === 1 ? "" : "s"}.`;
            })()}
          </p>
          {emails.sheetUrl && (
            <a
              href={emails.sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-small text-action"
            >
              <ExternalLink size={16} strokeWidth={1.5} />
              Open the contacts sheet
            </a>
          )}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <p className="text-small text-body">{result.message}</p>
          {result.sheetUrl && (
            <a
              href={result.sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-small text-action"
            >
              <ExternalLink size={16} strokeWidth={1.5} />
              Open the {result.kind} sheet
            </a>
          )}
          <p className="mt-3 text-small text-muted">
            The sheet’s top row shows status (Running… → Done). Refresh it in a few minutes.
            {result.kind === "companies" && " Then type “yes” in the Approve column and run step 2."}
          </p>
        </div>
      )}
    </Card>
  );
}
