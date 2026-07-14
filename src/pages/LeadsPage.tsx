import { ExternalLink } from "lucide-react";
import { Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";

const COLUMNS: TableColumn[] = [
  { key: "company", label: "Company" },
  { key: "open", label: "", width: "160px" },
];

export function LeadsPage() {
  const { data, loading, error } = useDriveData();
  const leads = data?.leads ?? [];

  const rows: TableRow[] = leads.map((l) => ({
    company: <span className="text-body">{l.name}</span>,
    open: (
      <a
        href={`https://drive.google.com/drive/folders/${l.id}`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 text-small text-action"
      >
        <ExternalLink size={16} strokeWidth={1.5} />
        Open in Drive
      </a>
    ),
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-h1 font-medium text-black">Leads</h1>
        <p className="mt-2 text-muted">
          Prospective clients — one folder per company, read live from Drive.
        </p>
      </header>

      <ListState
        loading={loading}
        error={error}
        isEmpty={leads.length === 0}
        emptyText="No leads yet — create a folder per company inside the Leads folder in your Drive."
      >
        <Table columns={COLUMNS} rows={rows} />
      </ListState>
    </div>
  );
}
