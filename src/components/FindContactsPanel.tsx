import { useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import { readContextDocText, type DriveFile } from "@/lib/drive";
import { startFindContacts } from "@/lib/finder";

type Phase = "idle" | "starting" | "started";

/**
 * The AI contact finder (LAB-22 / LAB-25). Reads the account's context doc and
 * kicks off a background research job on the server, which writes results into
 * the account's "targets" sheet. We don't wait for contacts — we hand back the
 * sheet link and let the research finish server-side.
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
  const [phase, setPhase] = useState<Phase>("idle");
  const [sheetUrl, setSheetUrl] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const canSearch = Boolean(contextDoc);

  async function run() {
    if (!token) return;
    setPhase("starting");
    setError(null);
    try {
      const contextText = contextDoc ? await readContextDocText(token, contextDoc.id) : "";
      const res = await startFindContacts(token, { accountName, accountFolderId, contextText });
      setSheetUrl(res.sheetUrl);
      setMessage(res.message);
      setPhase("started");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start the finder.");
      setPhase("idle");
    }
  }

  return (
    <Card title="Find contacts with AI">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-small text-muted">
          {canSearch
            ? "Reads this account's context document and researches real people to reach. Results are written to the account's targets sheet — this runs in the background and takes a few minutes."
            : "Add a context document to this account first — the AI uses it to know who to look for."}
        </p>
        {canSearch && phase !== "started" && (
          <Button onClick={() => void run()} disabled={phase === "starting"}>
            <Sparkles size={16} strokeWidth={1.5} />
            {phase === "starting" ? "Starting…" : "Find contacts"}
          </Button>
        )}
      </div>

      {error && <p className="mt-4 text-small text-danger-text">{error}</p>}

      {phase === "started" && (
        <div className="mt-4 rounded-card border border-border bg-surface p-4">
          <p className="text-small text-body">{message}</p>
          {sheetUrl && (
            <a
              href={sheetUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-small text-action"
            >
              <ExternalLink size={16} strokeWidth={1.5} />
              Open the targets sheet
            </a>
          )}
          <p className="mt-3 text-small text-muted">
            The sheet shows a status row (Running… → Done) — refresh it in a few minutes. You can run
            this again anytime; it refreshes the same sheet.
          </p>
          <button
            onClick={() => setPhase("idle")}
            className="mt-3 text-small text-muted underline-offset-2 hover:underline"
          >
            Run again
          </button>
        </div>
      )}
    </Card>
  );
}
