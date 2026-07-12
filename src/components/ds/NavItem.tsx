import React, { useState } from "react";

/**
 * lab2scale nav item. Active gets blue tint bg + blue-family text.
 * Inactive is muted gray. No underlines, no bars.
 * Ported from the lab2scale Design System (components/nav).
 */
export interface NavItemProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "style"> {
  active?: boolean;
  style?: React.CSSProperties;
}

export function NavItem({ active = false, children, style, ...rest }: NavItemProps) {
  const [hover, setHover] = useState(false);
  return (
    <a
      {...rest}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        height: "32px",
        padding: "0 12px",
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        fontWeight: active ? 500 : 400,
        lineHeight: 1,
        color: active ? "var(--action-text)" : "var(--text-muted)",
        background: active
          ? "var(--action-tint)"
          : hover
            ? "var(--neutral-100)"
            : "transparent",
        borderRadius: "var(--radius-control)",
        textDecoration: "none",
        cursor: "pointer",
        transition:
          "background 120ms cubic-bezier(0.16,1,0.3,1), color 120ms cubic-bezier(0.16,1,0.3,1)",
        ...style,
      }}
    >
      {children}
    </a>
  );
}
