import { useState } from "react";
import { Sparkles, ExternalLink } from "lucide-react";
import { Badge, Button, Table, type BadgeRole, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { qualifyLeads, type QualifyResult } from "@/lib/leads";

const COLUMNS: TableColumn[] = [
  { key: "company", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "stage", label: "Stage" },
  { key: "relevance", label: "Relevance" },
  { key: "status", label: "Status" },
  { key: "note", label: "Note" },
];

function statusRole(status?: string): BadgeRole {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("qualif")) return "success";
  if (s.startsWith("disqualif")) return "danger";
  return "neutral";
}

export function LeadsPage() {
  const { data, loading, error, reload } = useDriveData();
  const { token } = useAuth();
  const leads = data?.leads ?? [];

  const [qualifying, setQualifying] = useState(false);
  const [result, setResult] = useState<QualifyResult | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);

  async function qualify() {
    if (!token) return;
    setQualifying(true);
    setQualifyError(null);
    setResult(null);
    try {
      const res = await qualifyLeads(token);
      setResult(res);
      reload(); // pull the updated statuses back from the sheet
    } catch (e) {
      setQualifyError(e instanceof Error ? e.message : "Couldn't qualify leads.");
    } finally {
      setQualifying(false);
    }
  }

  const rows: TableRow[] = leads.map((l) => ({
    company: (
      <span className="text-body">
        {l.sourceUrl ? (
          <a href={l.sourceUrl} target="_blank" rel="noreferrer" className="text-action">
            {l.company}
          </a>
        ) : (
          l.company
        )}
      </span>
    ),
    sector: <span className="text-muted">{l.sector ?? ""}</span>,
    stage: <span className="text-muted">{l.stage ?? ""}</span>,
    relevance: <span className="text-muted">{l.relevance ?? ""}</span>,
    status: l.status ? <Badge role={statusRole(l.status)}>{l.status}</Badge> : "",
    note: <span className="text-small text-muted">{l.note ?? ""}</span>,
  }));

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium text-black">Leads</h1>
          <p className="mt-2 text-muted">
            {loading
              ? "Loading from Drive…"
              : `${leads.length} prospective ${leads.length === 1 ? "company" : "companies"}, read live from the Leads sheet.`}
          </p>
        </div>
        <Button onClick={() => void qualify()} disabled={qualifying || leads.length === 0}>
          <Sparkles size={16} strokeWidth={1.5} />
          {qualifying ? "Qualifying…" : "Qualify leads"}
        </Button>
      </header>

      {qualifyError && <p className="mb-4 text-small text-danger-text">{qualifyError}</p>}

      {result && (
        <div className="mb-4 rounded-card border border-border bg-surface p-4">
          <p className="text-small text-body">
            Qualified <strong>{result.qualified}</strong> · Disqualified{" "}
            <strong>{result.disqualified}</strong> of {result.total}. Statuses updated in the sheet.
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-small">
            {result.sheetUrl && (
              <a
                href={result.sheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-action"
              >
                <ExternalLink size={16} strokeWidth={1.5} />
                Open the Leads sheet
              </a>
            )}
            {result.rulesUrl && (
              <a
                href={result.rulesUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-action"
              >
                <ExternalLink size={16} strokeWidth={1.5} />
                {result.rulesCreated ? "Rules doc (just created — edit it)" : "Edit the rules"}
              </a>
            )}
          </div>
        </div>
      )}

      <ListState
        loading={loading}
        error={error}
        isEmpty={leads.length === 0}
        emptyText="No leads yet — add rows to the Leads sheet in your Drive."
      >
        <Table columns={COLUMNS} rows={rows} />
      </ListState>
    </div>
  );
}
