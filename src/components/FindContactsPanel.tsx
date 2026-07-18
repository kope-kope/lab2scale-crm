import { useState } from "react";
import { Sparkles, Users, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import { type DriveFile } from "@/lib/drive";
import { startFindCompanies, startFindContacts, type FinderStarted } from "@/lib/finder";

/**
 * The two-stage AI finder (LAB-25/26/27).
 *   Step 1 — find target companies → companies sheet (human marks "yes").
 *   Step 2 — find contacts at the approved companies → contacts sheet.
 * Both run in the background; we hand back the sheet link and let them fill in.
 */
export function FindContactsPanel({
  accountName,
  accountFolderId,
  contextDoc,
}: {
  accountName: string;
  accountFolderId: string;
  contextDoc?: DriveFile;
}) {
  const { token } = useAuth();
  const [busy, setBusy] = useState<null | "companies" | "contacts">(null);
  const [result, setResult] = useState<(FinderStarted & { kind: "companies" | "contacts" }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSearch = Boolean(contextDoc);

  async function go(kind: "companies" | "contacts") {
    if (!token) return;
    setBusy(kind);
    setError(null);
    try {
      const params = { accountName, accountFolderId, contextDocId: contextDoc?.id };
      const res = kind === "companies"
        ? await startFindCompanies(token, params)
        : await startFindContacts(token, params);
      setResult({ ...res, kind });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the finder.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Find contacts with AI">
      {!canSearch ? (
        <p className="text-small text-muted">
          Add a context document to this account first — the AI uses it to know who to look for.
        </p>
      ) : (
        <>
          <p className="max-w-prose text-small text-muted">
            Two steps. First find target <strong>companies</strong> from the context document and mark
            the ones to pursue with <strong>“yes”</strong> in the sheet. Then find <strong>contacts</strong>{" "}
            at the approved companies. Both run in the background and write to a sheet.
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
          </div>
        </>
      )}

      {error && <p className="mt-4 text-small text-danger-text">{error}</p>}

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
            {result.kind === "companies" &&
              " Then type “yes” in the Approve column and run step 2."}
          </p>
        </div>
      )}
    </Card>
  );
}
