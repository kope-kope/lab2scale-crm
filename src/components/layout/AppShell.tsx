import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Building2, Users, Target, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavItem } from "@/components/ds";
import { useAuth } from "@/auth/AuthProvider";

const NAV: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/accounts", label: "Accounts", icon: Building2 },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/leads", label: "Leads", icon: Target },
];

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
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
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

        <div className="mt-auto border-t border-border pt-4">
          <div className="px-3 text-small text-body">{user?.name ?? user?.email}</div>
          <div className="px-3 text-caption text-muted">{user?.email}</div>
          <button
            onClick={signOut}
            className="mt-2 inline-flex items-center gap-2 rounded-control px-3 py-2 text-small text-muted transition-colors ease-ds hover:bg-neutral-100 hover:text-body"
          >
            <LogOut size={16} strokeWidth={1.5} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
