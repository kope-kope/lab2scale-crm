import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, Users, Network, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavItem } from "@/components/ds";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/network", label: "Network", icon: Network },
  { to: "/leads", label: "Leads", icon: Target },
];

/** Plain-type wordmark with a blue "2" — provisional, per the design system. */
function Wordmark() {
  return (
    <span className="text-h3 font-medium text-black">
      lab<span className="text-action">2</span>scale
    </span>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface px-4 py-6 md:block">
        <div className="mb-8 flex items-center gap-2 px-3">
          <Wordmark />
          <span className="text-caption text-muted">CRM</span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname.startsWith(to);
            return (
              <NavItem
                key={to}
                href={to}
                active={active}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(to);
                }}
                style={{ width: "100%" }}
              >
                <Icon size={16} strokeWidth={1.5} />
                {label}
              </NavItem>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
