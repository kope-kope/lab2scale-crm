import React from "react";

/**
 * lab2scale metric block. Muted 12px label above, 22px/500 number below.
 * No border, #F6F6F6 fill, 8px radius.
 * Ported from the lab2scale Design System (components/metric).
 */
export interface MetricProps {
  label: string;
  value: React.ReactNode;
  /** Optional secondary line under the number */
  detail?: string;
  style?: React.CSSProperties;
}

export function Metric({ label, value, detail, style }: MetricProps) {
  return (
    <div
      style={{
        background: "var(--neutral-100)",
        borderRadius: "8px",
        padding: "16px",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: "12px",
          lineHeight: 1.4,
          color: "var(--text-muted)",
          marginBottom: "4px",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "22px", fontWeight: 500, lineHeight: 1.2, color: "#000000" }}>
        {value}
      </div>
      {detail && (
        <div
          style={{
            fontSize: "12px",
            lineHeight: 1.4,
            color: "var(--text-muted)",
            marginTop: "4px",
          }}
        >
          {detail}
        </div>
      )}
    </div>
  );
}
