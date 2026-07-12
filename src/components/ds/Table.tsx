import React from "react";

/**
 * lab2scale table. Hairline row separators only — no zebra, no vertical rules, no outer box.
 * Ported from the lab2scale Design System (components/table).
 */
export interface TableColumn {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  width?: string;
}

export type TableRow = Record<string, React.ReactNode>;

export interface TableProps {
  columns: TableColumn[];
  rows: TableRow[];
  onRowClick?: (row: TableRow, index: number) => void;
  style?: React.CSSProperties;
}

export function Table({ columns = [], rows = [], onRowClick, style }: TableProps) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <thead>
        <tr>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                textAlign: c.align || "left",
                fontSize: "12px",
                fontWeight: 500,
                lineHeight: 1.4,
                color: "var(--text-muted)",
                padding: "12px 16px 12px 0",
                borderBottom: "1px solid var(--border)",
                width: c.width,
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr
            key={i}
            onClick={onRowClick ? () => onRowClick(r, i) : undefined}
            style={{ cursor: onRowClick ? "pointer" : "default" }}
          >
            {columns.map((c) => (
              <td
                key={c.key}
                style={{
                  textAlign: c.align || "left",
                  fontSize: "13px",
                  lineHeight: 1.5,
                  color: "var(--text-body)",
                  padding: "12px 16px 12px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {r[c.key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
