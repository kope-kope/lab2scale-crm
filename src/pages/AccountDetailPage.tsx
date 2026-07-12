import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search } from "lucide-react";
import { Button, Card, Metric } from "@/components/ds";
import { MOCK_ACCOUNTS } from "@/data/mock";

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
  const account = MOCK_ACCOUNTS.find((a) => a.id === id);

  if (!account) {
    return (
      <div>
        <BackLink />
        <p className="mt-8 text-muted">That account isn’t here.</p>
      </div>
    );
  }

  return (
    <div>
      <BackLink />

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-h1 font-medium text-black">{account.name}</h1>
          <p className="mt-2 text-muted">{account.one_liner}</p>
          <a
            href={`https://${account.website}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-small text-action"
          >
            {account.website}
          </a>
        </div>
        {/* The one primary action on this view. Wired in Phase 2. */}
        <Button disabled>
          <Search size={16} strokeWidth={1.5} />
          Find contacts
        </Button>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Contacts found" value="0" />
        <Metric label="Warm paths" value="0" />
        <Metric label="Drafts ready" value="0" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Account context">
          <p className="text-small text-muted">
            The configurable brain that makes the search good — target customer,
            exclusions, titles, geo, size, signals. The context editor lands in
            Phase 1.
          </p>
        </Card>

        <Card title="Contacts">
          <p className="text-small text-muted">
            No contacts yet. In Phase 2, find contacts runs the finder agent and
            fills this in — each with a reason it picked them and a warm path
            where one exists.
          </p>
        </Card>
      </div>
    </div>
  );
}
