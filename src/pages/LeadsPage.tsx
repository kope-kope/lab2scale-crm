import { Badge, Table, type BadgeRole, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";

const RANK_ROLE: Record<string, BadgeRole> = {
  a: "success",
  b: "action",
  c: "neutral",
};

const COLUMNS: TableColumn[] = [
  { key: "company", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "rank", label: "Rank", width: "90px" },
  { key: "rationale", label: "Why" },
];

export function LeadsPage() {
  const { data, loading, error } = useDriveData();
  const leads = data?.leads ?? [];

  const rows: TableRow[] = leads.map((l) => ({
    company: <span className="text-body">{l.company || l.id}</span>,
    sector: l.sector ?? "",
    rank: l.rank ? (
      <Badge role={RANK_ROLE[l.rank.toLowerCase()] ?? "neutral"}>{l.rank}</Badge>
    ) : (
      ""
    ),
    rationale: <span className="text-muted">{l.rationale ?? ""}</span>,
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-h1 font-medium text-black">Leads</h1>
        <p className="mt-2 text-muted">Prospective clients, read live from Drive.</p>
      </header>

      <ListState
        loading={loading}
        error={error}
        isEmpty={leads.length === 0}
        emptyText="No leads yet — add a row to the Leads sheet in your Drive folder."
      >
        <Table columns={COLUMNS} rows={rows} />
      </ListState>
    </div>
  );
}
