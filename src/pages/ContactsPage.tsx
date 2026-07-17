import { Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { AddContactForm } from "@/components/AddContactForm";
import { useDriveData } from "@/data/DriveDataProvider";

const COLUMNS: TableColumn[] = [
  { key: "name", label: "Name" },
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "email", label: "Email" },
];

export function ContactsPage() {
  const { data, loading, error } = useDriveData();
  const contacts = data?.contacts ?? [];

  const rows: TableRow[] = contacts.map((c) => ({
    name: <span className="text-body">{c.name || c.id}</span>,
    title: c.title ?? "",
    company: c.company ?? "",
    email: c.email ? (
      <a href={`mailto:${c.email}`} className="text-action">
        {c.email}
      </a>
    ) : (
      ""
    ),
  }));

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-h1 font-medium text-black">Contacts</h1>
        <p className="mt-2 text-muted">People across your accounts, read live from Drive.</p>
      </header>

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
