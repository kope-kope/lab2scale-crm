import { useNavigate } from "react-router-dom";
import { Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";

const COLUMNS: TableColumn[] = [{ key: "account", label: "Account" }];

export function AccountsPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useDriveData();
  const accounts = data?.accounts ?? [];

  const rows: TableRow[] = accounts.map((a) => ({
    account: <span className="text-body">{a.name}</span>,
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-h1 font-medium text-black">Accounts</h1>
        <p className="mt-2 text-muted">
          Signed clients — one folder per company, read live from Drive.
        </p>
      </header>

      <ListState
        loading={loading}
        error={error}
        isEmpty={accounts.length === 0}
        emptyText="No accounts yet — create a folder per company inside the Accounts folder in your Drive."
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
