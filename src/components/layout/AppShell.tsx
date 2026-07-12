import { NavLink, Outlet } from "react-router-dom";
import { Building2, Users, Network, Target, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/network", label: "Network", icon: Network },
  { to: "/leads", label: "Leads", icon: Target },
];

export function AppShell() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-[1400px]">
        {/* Sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-border px-4 py-6 md:block">
          <div className="mb-8 flex items-center gap-2 px-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              l2s
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">lab2scale</p>
              <p className="text-xs text-muted-foreground">CRM</p>
            </div>
          </div>

          <nav className="space-y-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-8 rounded-lg border border-border bg-card p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              MVP focus
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Open an account, hit <span className="font-medium text-foreground">Find contacts</span>,
              review the drafts. Never sends.
            </p>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 px-6 py-6 md:px-10 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
