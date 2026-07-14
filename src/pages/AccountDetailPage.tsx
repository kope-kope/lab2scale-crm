import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Card, Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";

const CONTACT_COLUMNS: TableColumn[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "email", label: "Email" },
];

function BackLink() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate("/accounts")}
      className="inline-flex items-center gap-1.5 text-small text-muted transition-colors ease-ds hover:text-body"
    >
      <ArrowLeft size={16} strokeWidth={1.5} />
      Accounts
    </button>
  );
}

export function AccountDetailPage() {
  const { id } = useParams();
  const { data, loading, error } = useDriveData();
  const account = data?.accounts.find((a) => a.id === id);
  const contacts = (data?.contacts ?? []).filter((c) => c.account_id === id);

  if (!loading && !account) {
    return (
      <div>
        <BackLink />
        <p className="mt-8 text-muted">That account isn’t in Drive.</p>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <header className="mt-4">
        <h1 className="text-h1 font-medium text-black">{account?.name || account?.id || "…"}</h1>
        {account?.one_liner && <p className="mt-2 text-muted">{account.one_liner}</p>}
        {account?.website && (
          <a
            href={`https://${account.website}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-small text-action"
          >
            {account.website}
          </a>
        )}
      </header>

      <div className="mt-8">
        <Card title="Contacts">
          <ListState
            loading={loading}
            error={error}
            isEmpty={contacts.length === 0}
            emptyText="No contacts linked to this account yet (match on account_id in the Contacts sheet)."
          >
            <Table
              columns={CONTACT_COLUMNS}
              rows={contacts.map<TableRow>((c) => ({
                name: c.name || c.id,
                title: c.title ?? "",
                email: c.email ? (
                  <a href={`mailto:${c.email}`} className="text-action">
                    {c.email}
                  </a>
                ) : (
                  ""
                ),
              }))}
            />
          </ListState>
        </Card>
      </div>
    </div>
  );
}
