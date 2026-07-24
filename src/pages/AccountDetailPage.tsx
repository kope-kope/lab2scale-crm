import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Folder, ExternalLink, Mail, Loader2 } from "lucide-react";
import { Card, Table, type TableColumn, type TableRow } from "@/components/ds";
import { ListState } from "@/components/ListState";
import { useDriveData } from "@/data/DriveDataProvider";
import { useAuth } from "@/auth/AuthProvider";
import { listFolderFiles, CONTEXT_DOC_PREFIX, type DriveFile } from "@/lib/drive";
import { findEmailsForAccount } from "@/lib/enrich";
import { FindContactsPanel } from "@/components/FindContactsPanel";
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
  const { data, loading: dataLoading, reload } = useDriveData();
  const account = data?.accounts.find((a) => a.id === id);

  const [files, setFiles] = useState<DriveFile[] | null>(null);
  const [filesError, setFilesError] = useState<string | null>(null);

  // Contact email enrichment (Hunter, server-side).
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);
  const [enrichError, setEnrichError] = useState<string | null>(null);

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
  const contextDoc = (files ?? []).find((f) => f.name.startsWith(CONTEXT_DOC_PREFIX));

  // Contacts we can look up: a real name, no email yet.
  const missingEmail = contacts.filter((c) => (c.name ?? "").trim() && !(c.email ?? "").trim());

  async function findEmails() {
    if (!token || !account || missingEmail.length === 0 || enriching) return;
    setEnriching(true);
    setEnrichMsg(null);
    setEnrichError(null);
    try {
      const r = await findEmailsForAccount(
        token,
        account.name,
        missingEmail.map((c) => ({ id: c.id, name: c.name ?? "", company: c.company, hasEmail: false })),
      );
      const notFound = r.results.filter((x) => x.outcome === "not_found").length;
      const errored = r.results.filter((x) => x.outcome === "error").length;
      const parts = [`Found ${r.found} of ${missingEmail.length}`];
      if (r.written) parts.push(`wrote ${r.written} to the sheet`);
      if (notFound) parts.push(`${notFound} not found`);
      if (errored) parts.push(`${errored} errored`);
      setEnrichMsg(`${parts.join(" · ")}.`);
      reload(); // re-read the Contacts sheet so filled emails show
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : "Couldn't find emails.");
    } finally {
      setEnriching(false);
    }
  }

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

      {contextDoc?.webViewLink && (
        <a
          href={contextDoc.webViewLink}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-card border border-border bg-surface px-4 py-3 text-small text-action transition-colors ease-ds hover:border-border-hover"
        >
          <FileText size={16} strokeWidth={1.5} />
          Open context document
        </a>
      )}

      {account && (
        <div className="mt-6">
          <FindContactsPanel accountName={account.name} accountFolderId={account.id} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
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

        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-h3 font-medium text-black">Contacts</span>
            {missingEmail.length > 0 && (
              <button
                onClick={() => void findEmails()}
                disabled={enriching}
                title={`Find emails for ${missingEmail.length} contact${missingEmail.length === 1 ? "" : "s"} via Hunter`}
                className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-small text-action transition-colors ease-ds hover:bg-neutral-100 disabled:opacity-40"
              >
                {enriching ? (
                  <Loader2 size={15} strokeWidth={1.5} className="animate-spin" />
                ) : (
                  <Mail size={15} strokeWidth={1.5} />
                )}
                Find emails ({missingEmail.length})
              </button>
            )}
          </div>
          {enrichMsg && <p className="mb-3 text-small text-muted">{enrichMsg}</p>}
          {enrichError && <p className="mb-3 text-small text-danger-text">{enrichError}</p>}
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
