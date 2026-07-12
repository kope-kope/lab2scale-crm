import React, { useState } from "react";

/**
 * lab2scale input. 40px tall, hairline border, blue focus ring.
 * Placeholders show a real example, not the label repeated.
 * Ported from the lab2scale Design System (components/input).
 */
export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "style"> {
  label?: string;
  style?: React.CSSProperties;
}

export function Input({ label, placeholder, type = "text", style, ...rest }: InputProps) {
  const [focus, setFocus] = useState(false);
  return (
    <label style={{ display: "block", fontFamily: "var(--font-sans)" }}>
      {label && (
        <span
          style={{
            display: "block",
            fontSize: "13px",
            color: "var(--text-body)",
            marginBottom: "8px",
          }}
        >
          {label}
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          height: "40px",
          width: "100%",
          boxSizing: "border-box",
          padding: "0 12px",
          fontFamily: "var(--font-sans)",
          fontSize: "15px",
          color: "var(--text-body)",
          background: "#FFFFFF",
          border: `1px solid ${focus ? "var(--action)" : "var(--border)"}`,
          borderRadius: "var(--radius-control)",
          outline: "none",
          boxShadow: focus ? "var(--focus-ring)" : "none",
          transition:
            "border-color 120ms cubic-bezier(0.16,1,0.3,1), box-shadow 120ms cubic-bezier(0.16,1,0.3,1)",
          ...style,
        }}
        {...rest}
      />
    </label>
  );
}
