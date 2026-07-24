import { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { AddContactForm } from "@/components/AddContactForm";
import { useDriveData } from "@/data/DriveDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { findEmails } from "@/lib/enrich";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
];

export function ContactsPage() {
  const { data, loading, error, reload } = useDriveData();
  const { token } = useAuth();
  const contacts = data?.contacts ?? [];

  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  async function runFindEmails() {
    if (!token || enriching) return;
    setEnriching(true);
    setEnrichMsg(null);
    setEnrichError(null);
    try {
      const r = await findEmails(token);
      const notFound = r.results.filter((x) => x.outcome === "not_found").length;
      const errored = r.results.filter((x) => x.outcome === "error").length;
      const parts = [`Found ${r.found} email${r.found === 1 ? "" : "s"}`];
      if (r.written) parts.push(`wrote ${r.written} to the sheet`);
      if (r.skipped) parts.push(`${r.skipped} already had one`);
      if (notFound) parts.push(`${notFound} not found`);
      if (errored) parts.push(`${errored} errored`);
      setEnrichMsg(`${parts.join(" · ")}. Checked ${r.total} contact${r.total === 1 ? "" : "s"}.`);
      reload(); // re-read the sheet so filled emails show
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Couldn't find emails.");
    } finally {
      setEnriching(false);
    }
  }

  const rows: TableRow[] = contacts.map((c) => ({
    name: <span className="text-body">{c.name || c.id}</span>,
    title: c.title ?? "",
    company: c.company ?? "",
    email: c.email ? (
      <a href={`mailto:${c.email}`} className="text-action">
        {c.email}
      </a>
    ) : (
      <span className="text-muted">—</span>
    ),
  }));

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium text-black">Contacts</h1>
          <p className="mt-2 text-muted">People across your accounts, read live from Drive.</p>
        </div>
        <button
          onClick={() => void runFindEmails()}
          disabled={enriching || !token}
          title="Find emails for every contact in the sheet that's missing one (via Hunter)"
          className="inline-flex items-center gap-2 rounded-control border border-border px-3 py-2 text-small text-body transition-colors ease-ds hover:bg-neutral-100 disabled:opacity-40"
        >
          {enriching ? (
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          ) : (
            <Mail size={16} strokeWidth={1.5} />
          )}
          Find emails
        </button>
      </header>

      {enrichMsg && <p className="mb-4 text-small text-muted">{enrichMsg}</p>}
      {enrichError && <p className="mb-4 text-small text-danger-text">{enrichError}</p>}

      <div className="mb-6">
        <AddContactForm />
      </div>

      <ListState
        loading={loading}
        error={error}
        isEmpty={contacts.length === 0}
        emptyText="No contacts yet — add a row to the Contacts sheet in your Drive folder."
      >
        <Table columns={COLUMNS} rows={rows} />
      </ListState>
    </div>
  );
}
