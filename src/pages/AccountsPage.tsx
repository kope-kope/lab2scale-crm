import { useNavigate } from "react-router-dom";
import { Badge, Table, type BadgeRole, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";

const STATUS_ROLE: Record<string, BadgeRole> = {
  active: "success",
  signed: "success",
  onboarding: "action",
  paused: "neutral",
};

const COLUMNS: TableColumn[] = [
  { key: "account", label: "Account" },
  { key: "stage", label: "Stage", width: "120px" },
  { key: "owner", label: "Owner", width: "120px" },
  { key: "status", label: "Status", width: "120px" },
];

export function AccountsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useDriveData();
  const accounts = data?.accounts ?? [];

  const rows: TableRow[] = accounts.map((a) => ({
    account: (
      <div>
        <div className="text-small text-body">{a.name || a.id}</div>
        {a.one_liner && <div className="text-caption text-muted">{a.one_liner}</div>}
      </div>
    ),
    stage: a.stage ?? "",
    owner: a.owner ?? "",
    status: a.status ? (
      <Badge role={STATUS_ROLE[a.status.toLowerCase()] ?? "neutral"}>{a.status}</Badge>
    ) : (
      ""
    ),
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-h1 font-medium text-black">Accounts</h1>
        <p className="mt-2 text-muted">Signed clients, read live from Drive.</p>
      </header>

      <ListState
        loading={loading}
        error={error}
        isEmpty={accounts.length === 0}
        emptyText="No accounts yet — add a row to the Accounts sheet in your Drive folder."
      >
        <Table
          columns={COLUMNS}
          rows={rows}
          onRowClick={(_row, i) => navigate(`/accounts/${accounts[i].id}`)}
        />
      </ListState>
    </div>
  );
}
