import React from "react";

/**
 * lab2scale card. White, 1px hairline, 12px radius, 20px padding, no shadow.
 * Cards do not nest.
 * Ported from the lab2scale Design System (components/card).
 */
export interface CardProps {
  title?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

export function Card({ title, children, style }: CardProps) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        padding: "20px",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: "18px",
            fontWeight: 500,
            lineHeight: 1.4,
            color: "#000000",
            marginBottom: "12px",
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
