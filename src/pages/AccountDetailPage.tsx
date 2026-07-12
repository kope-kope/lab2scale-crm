import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Search, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_ACCOUNTS } from "@/data/mock";

export function AccountDetailPage() {
  const { id } = useParams();
  const account = MOCK_ACCOUNTS.find((a) => a.id === id);

  if (!account) {
    return (
      <div>
        <Link
          to="/accounts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Accounts
        </Link>
        <p className="mt-6 text-sm text-muted-foreground">Account not found.</p>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/accounts"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Accounts
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{account.one_liner}</p>
          <a
            href={`https://${account.website}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
          >
            <Globe className="h-3.5 w-3.5" />
            {account.website}
          </a>
        </div>
        <Button disabled title="Wired in Phase 2">
          <Search className="h-4 w-4" />
          Find contacts
        </Button>
      </header>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Account context</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The configurable brain that makes the search good — target customer,
            exclusions, titles, geo, size, signals. The context editor lands in
            Phase 1.
          </p>
        </section>

        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Contacts</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            No contacts yet. In Phase 2, “Find contacts” runs the finder agent and
            fills this in — each with a <span className="font-medium">why_them</span>{" "}
            rationale and a warm path where one exists.
          </p>
        </section>
      </div>
    </div>
  );
}
