import { useState } from "react";
import { Sparkles, ExternalLink, Trash2, Loader2 } from "lucide-react";
import { Badge, Button, Table, type BadgeRole, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { qualifyLeads, qualifyLead, deleteLead, type QualifyResult } from "@/lib/leads";

const COLUMNS: TableColumn[] = [
  { key: "company", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "stage", label: "Stage" },
  { key: "relevance", label: "Relevance" },
  { key: "status", label: "Verdict" },
  { key: "note", label: "Screen" },
  { key: "actions", label: "", width: "150px" },
];

function statusRole(status?: string): BadgeRole {
  const s = (status ?? "").toLowerCase();
  if (s.startsWith("pursue") || s.startsWith("qualif")) return "success";
  if (s.startsWith("gate")) return "warning";
  if (s.startsWith("pass") || s.startsWith("disqualif")) return "danger";
  return "neutral";
}

export function LeadsPage() {
  const { data, loading, error, reload } = useDriveData();
  const { token } = useAuth();
  const leads = data?.leads ?? [];

  const [qualifying, setQualifying] = useState(false);
  const [result, setResult] = useState<QualifyResult | null>(null);
  const [qualifyError, setQualifyError] = useState<string | null>(null);
  // Which row is mid-action (keyed by company), and what it's doing.
  const [busyRow, setBusyRow] = useState<{ company: string; action: "qualify" | "delete" } | null>(null);

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

  async function qualifyRow(company: string, rowIndex: number) {
    if (!token) return;
    setBusyRow({ company, action: "qualify" });
    setQualifyError(null);
    try {
      await qualifyLead(token, company, rowIndex);
      reload();
    } catch (e) {
      setQualifyError(e instanceof Error ? e.message : `Couldn't qualify ${company}.`);
    } finally {
      setBusyRow(null);
    }
  }

  async function removeRow(company: string, rowIndex: number) {
    if (!token) return;
    if (!window.confirm(`Delete "${company}" from the Leads sheet? This can't be undone.`)) return;
    setBusyRow({ company, action: "delete" });
    setQualifyError(null);
    try {
      await deleteLead(token, company, rowIndex);
      reload();
    } catch (e) {
      setQualifyError(e instanceof Error ? e.message : `Couldn't delete ${company}.`);
    } finally {
      setBusyRow(null);
    }
  }

  const anyBusy = qualifying || busyRow !== null;
  const rows: TableRow[] = leads.map((l, i) => {
    const busy = busyRow?.company === l.company;
    return {
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
      note: (
        <span className="text-small text-muted" title={l.note ?? ""}>
          {(l.note ?? "").replace(/\s+/g, " ").slice(0, 160)}
          {(l.note ?? "").length > 160 ? "…" : ""}
        </span>
      ),
      actions: (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => void qualifyRow(l.company, i)}
            disabled={anyBusy}
            title="Qualify this lead"
            className="inline-flex items-center gap-1 rounded-control px-2 py-1 text-small text-action transition-colors ease-ds hover:bg-neutral-100 disabled:opacity-40"
          >
            {busy && busyRow?.action === "qualify" ? (
              <Loader2 size={15} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Sparkles size={15} strokeWidth={1.5} />
            )}
            Qualify
          </button>
          <button
            onClick={() => void removeRow(l.company, i)}
            disabled={anyBusy}
            title="Delete this lead"
            className="inline-flex items-center rounded-control px-2 py-1 text-small text-muted transition-colors ease-ds hover:bg-neutral-100 hover:text-danger-text disabled:opacity-40"
          >
            {busy && busyRow?.action === "delete" ? (
              <Loader2 size={15} strokeWidth={1.5} className="animate-spin" />
            ) : (
              <Trash2 size={15} strokeWidth={1.5} />
            )}
          </button>
        </div>
      ),
    };
  });

  // Verdict/status tally for the header summary.
  const order = ["Pursue", "Gate", "Pass"];
  const tally = leads.reduce<Record<string, number>>((acc, l) => {
    const k = (l.status ?? "").trim() || "Unscreened";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const tallyKeys = [
    ...order.filter((k) => tally[k]),
    ...Object.keys(tally)
      .filter((k) => !order.includes(k))
      .sort(),
  ];

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
          {!loading && leads.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tallyKeys.map((k) => (
                <Badge key={k} role={statusRole(k)}>
                  {tally[k]} {k}
                </Badge>
              ))}
            </div>
          )}
        </div>
        <Button onClick={() => void qualify()} disabled={anyBusy || leads.length === 0}>
          <Sparkles size={16} strokeWidth={1.5} />
          {qualifying ? "Qualifying…" : "Qualify all"}
        </Button>
      </header>

      {qualifyError && <p className="mb-4 text-small text-danger-text">{qualifyError}</p>}

      {result && (
        <div className="mb-4 rounded-card border border-border bg-surface p-4">
          <p className="text-small text-body">
            Screened {result.total}: <strong>{result.pursue}</strong> Pursue ·{" "}
            <strong>{result.gate}</strong> Gate · <strong>{result.pass}</strong> Pass. Verdicts and
            full screens written to the sheet.
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
