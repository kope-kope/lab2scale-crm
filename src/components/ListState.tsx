import type { ReactNode } from "react";

/**
 * Loading / error / empty states for a data screen. Errors say what happened;
 * empty states are an invitation, not an apology.
 */
export function ListState({
  loading,
  error,
  isEmpty,
  emptyText,
  children,
}: {
  loading: boolean;
  error: string | null;
  isEmpty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="py-20 text-center text-small text-muted">Loading from Drive…</div>
    );
  }
  if (error) {
    return (
      <div className="rounded-card border border-border bg-surface p-5 text-small text-danger-text">
        {error}
      </div>
    );
  }
  if (isEmpty) {
    return (
      <div className="rounded-card border border-dashed border-border px-6 py-20 text-center text-small text-muted">
        {emptyText}
      </div>
    );
  }
  return <>{children}</>;
}
