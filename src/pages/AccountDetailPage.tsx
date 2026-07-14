import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Folder, ExternalLink } from "lucide-react";
import { Card, Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { listFolderFiles, type DriveFile } from "@/lib/drive";
import { CONFIG } from "@/config";

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
  const { token } = useAuth();
  const { data, loading: dataLoading } = useDriveData();
  const account = data?.accounts.find((a) => a.id === id);

  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    setFiles(null);
    setFilesError(null);
    listFolderFiles(token, CONFIG.driveFolderId, id)
      .then((f) => !cancelled && setFiles(f))
      .catch((e: unknown) =>
        !cancelled && setFilesError(e instanceof Error ? e.message : "Couldn't list files."),
      );
    return () => {
      cancelled = true;
    };
  }, [token, id]);

  const contacts = (data?.contacts ?? []).filter(
    (c) => c.account === account?.name || c.company === account?.name,
  );

  if (!dataLoading && !account) {
    return (
      <div>
        <BackLink />
        <p className="mt-8 text-muted">That account folder isn’t in Drive.</p>
      </div>
    );
  }

  return (
    <div>
      <BackLink />
      <header className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 font-medium text-black">{account?.name ?? "…"}</h1>
        {account && (
          <a
            href={`https://drive.google.com/drive/folders/${account.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-small text-action"
          >
            <ExternalLink size={16} strokeWidth={1.5} />
            Open folder in Drive
          </a>
        )}
      </header>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Files">
          <ListState
            loading={files === null && !filesError}
            error={filesError}
            isEmpty={(files?.length ?? 0) === 0}
            emptyText="This folder has no files yet."
          >
            <ul className="space-y-2">
              {(files ?? []).map((f) => {
                const isFolder = f.mimeType === "application/vnd.google-apps.folder";
                return (
                  <li key={f.id} className="flex items-center gap-2 text-small">
                    {isFolder ? (
                      <Folder size={16} strokeWidth={1.5} className="text-muted" />
                    ) : (
                      <FileText size={16} strokeWidth={1.5} className="text-muted" />
                    )}
                    {f.webViewLink ? (
                      <a href={f.webViewLink} target="_blank" rel="noreferrer" className="text-action">
                        {f.name}
                      </a>
                    ) : (
                      <span className="text-body">{f.name}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </ListState>
        </Card>

        <Card title="Contacts">
          <ListState
            loading={dataLoading}
            error={null}
            isEmpty={contacts.length === 0}
            emptyText="No contacts linked yet — set a contact's account to this company name in the Contacts sheet."
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
