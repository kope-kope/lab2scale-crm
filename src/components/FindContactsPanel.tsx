import { useState } from "react";
import { Sparkles, Plus, Check, ExternalLink } from "lucide-react";
import { Button, Card } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";
import { useDriveData } from "@/data/DriveDataProvider";
import { readContextDocText, appendContact, type DriveFile } from "@/lib/drive";
import { findContacts, type FoundContact } from "@/lib/finder";
import { CONFIG } from "@/config";

type Phase = "idle" | "searching" | "done";

/**
 * The AI contact finder (LAB-22). Reads the account's context doc, asks the
 * server to research real contacts from it, and lets the user add the good
 * ones to the Contacts sheet linked to this account.
 */
export function FindContactsPanel({
  accountName,
  contextDoc,
}: {
  accountName: string;
  contextDoc?: DriveFile;
}) {
  const { token } = useAuth();
  const { reload } = useDriveData();
  const [phase, setPhase] = useState<Phase>("idle");
  const [results, setResults] = useState<FoundContact[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [addingAll, setAddingAll] = useState(false);

  async function run() {
    if (!token) return;
    setPhase("searching");
    setError(null);
    setNote(null);
    setResults([]);
    setAdded(new Set());
    try {
      const contextText = contextDoc ? await readContextDocText(token, contextDoc.id) : "";
      const res = await findContacts(token, accountName, contextText);
      setResults(res.contacts);
      setNote(res.note ?? null);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't find contacts.");
      setPhase("idle");
    }
  }

  async function add(index: number) {
    if (!token || added.has(index)) return;
    const c = results[index];
    await appendContact(
      token,
      CONFIG.driveFolderId,
      {
        name: c.name,
        title: c.title,
        company: c.company,
        account: accountName,
        email: c.email,
        notes: [c.rationale, c.linkedin].filter(Boolean).join(" — "),
      },
      () => `c-${Date.now()}-${index}`,
    );
    setAdded((prev) => new Set(prev).add(index));
  }

  async function addAll() {
    if (!token) return;
    setAddingAll(true);
    try {
      // Sequential — appends share one sheet, so avoid racing writes.
      for (let i = 0; i < results.length; i++) {
        if (!added.has(i)) await add(i);
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add the contacts.");
    } finally {
      setAddingAll(false);
    }
  }

  const showFindButton = phase !== "searching";
  const canSearch = Boolean(contextDoc);

  return (
    <Card title="Find contacts with AI">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-prose text-small text-muted">
          {canSearch
            ? "Reads this account's context document and researches real people to reach. You review each one before it's saved."
            : "Add a context document to this account first — the AI uses it to know who to look for."}
        </p>
        {showFindButton && canSearch && (
          <Button variant={phase === "idle" ? "primary" : "secondary"} onClick={() => void run()}>
            <Sparkles size={16} strokeWidth={1.5} />
            {phase === "idle" ? "Find contacts" : "Search again"}
          </Button>
        )}
      </div>

      {phase === "searching" && (
        <p className="mt-4 text-small text-muted">
          Researching from the context document — this can take up to a minute…
        </p>
      )}

      {error && <p className="mt-4 text-small text-danger-text">{error}</p>}

      {phase === "done" && results.length === 0 && !error && (
        <p className="mt-4 text-small text-muted">
          {note || "No contacts found from the context."}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <p className="text-small text-muted">
              {results.length} found · {added.size} added
            </p>
            <Button
              variant="secondary"
              onClick={() => void addAll()}
              disabled={addingAll || added.size === results.length}
            >
              {addingAll ? "Adding…" : "Add all"}
            </Button>
          </div>
          <ul>
            {results.map((c, i) => (
              <li
                key={`${c.name}-${i}`}
                className="flex items-start justify-between gap-3 border-b border-border py-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-body font-medium">{c.name}</p>
                  <p className="text-small text-muted">
                    {[c.title, c.company].filter(Boolean).join(" · ")}
                  </p>
                  {c.rationale && <p className="mt-1 text-small text-muted">{c.rationale}</p>}
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-small">
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="text-action">
                        {c.email}
                      </a>
                    )}
                    {c.linkedin && (
                      <a
                        href={c.linkedin}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-action"
                      >
                        <ExternalLink size={14} strokeWidth={1.5} />
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  disabled={added.has(i)}
                  onClick={() =>
                    void add(i)
                      .then(reload)
                      .catch((e: unknown) =>
                        setError(e instanceof Error ? e.message : "Couldn't add the contact."),
                      )
                  }
                >
                  {added.has(i) ? (
                    <>
                      <Check size={16} strokeWidth={1.5} /> Added
                    </>
                  ) : (
                    <>
                      <Plus size={16} strokeWidth={1.5} /> Add
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
