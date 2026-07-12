import React from "react";

/**
 * lab2scale badge/pill. Semantic tint background, same-family dark text.
 * Ported from the lab2scale Design System (components/badge).
 */
export type BadgeRole = "action" | "success" | "warning" | "danger" | "neutral";

export interface BadgeProps {
  role?: BadgeRole;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

const roles: Record<BadgeRole, { bg: string; text: string }> = {
  action: { bg: "var(--action-tint)", text: "var(--action-text)" },
  success: { bg: "var(--success-tint)", text: "var(--success-text)" },
  warning: { bg: "var(--warning-tint)", text: "var(--warning-text)" },
  danger: { bg: "var(--danger-tint)", text: "var(--danger-text)" },
  neutral: { bg: "var(--neutral-100)", text: "var(--neutral-700)" },
};

export function Badge({ role = "neutral", children, style }: BadgeProps) {
  const c = roles[role] || roles.neutral;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 9px",
        fontFamily: "var(--font-sans)",
        fontSize: "12px",
        fontWeight: 500,
        lineHeight: "1.4",
        borderRadius: "var(--radius-pill)",
        background: c.bg,
        color: c.text,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
