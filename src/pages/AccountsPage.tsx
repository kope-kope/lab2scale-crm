import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MOCK_ACCOUNTS, type AccountStatus } from "@/data/mock";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<AccountStatus, string> = {
  active: "bg-primary/10 text-primary",
  onboarding: "bg-accent/10 text-accent",
  paused: "bg-muted text-muted-foreground",
};

export function AccountsPage() {
  const accounts = MOCK_ACCOUNTS;

  return (
    <div>
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed clients. Open one and find their customers.
          </p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          New account
        </Button>
      </header>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Account</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium text-right">Contacts</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border last:border-0 transition-colors hover:bg-secondary/40"
              >
                <td className="px-4 py-3">
                  <Link to={`/accounts/${a.id}`} className="block">
                    <span className="font-medium text-foreground">{a.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {a.one_liner}
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{a.stage}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.owner}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {a.contacts}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
                      STATUS_STYLE[a.status]
                    )}
                  >
                    {a.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Showing placeholder data. The Google Sheets data layer lands in Phase 1.
      </p>
    </div>
  );
}
