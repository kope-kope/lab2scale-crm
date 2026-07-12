import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge, Button, Table, type BadgeRole, type TableColumn, type TableRow } from "@/components/ds";
import { MOCK_ACCOUNTS, type AccountStatus } from "@/data/mock";

const STATUS_ROLE: Record<AccountStatus, BadgeRole> = {
  active: "success",
  onboarding: "action",
  paused: "neutral",
};

const COLUMNS: TableColumn[] = [
  { key: "account", label: "Account" },
  { key: "stage", label: "Stage", width: "120px" },
  { key: "owner", label: "Owner", width: "120px" },
  { key: "contacts", label: "Contacts", align: "right", width: "100px" },
  { key: "status", label: "Status", width: "120px" },
];

export function AccountsPage() {
  const navigate = useNavigate();
  const accounts = MOCK_ACCOUNTS;

  const rows: TableRow[] = accounts.map((a) => ({
    account: (
      <div>
        <div className="text-small text-body">{a.name}</div>
        <div className="text-caption text-muted">{a.one_liner}</div>
      </div>
    ),
    stage: a.stage,
    owner: a.owner,
    contacts: <span className="font-mono">{a.contacts}</span>,
    status: (
      <Badge role={STATUS_ROLE[a.status]}>
        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
      </Badge>
    ),
  }));

  return (
    <div>
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-h1 font-medium text-black">Accounts</h1>
          <p className="mt-2 text-muted">
            Signed clients. Open one and find their customers.
          </p>
        </div>
        <Button>
          <Plus size={16} strokeWidth={1.5} />
          New account
        </Button>
      </header>

      <Table
        columns={COLUMNS}
        rows={rows}
        onRowClick={(_row, i) => navigate(`/accounts/${accounts[i].id}`)}
      />

      <p className="mt-6 text-caption text-muted">
        Placeholder data. The Google Sheets layer lands in Phase 1.
      </p>
    </div>
  );
}
