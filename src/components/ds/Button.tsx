import React, { useState } from "react";

/**
 * lab2scale button. Primary = the one blue action per view.
 * Labels are verb-first, 1–3 words, no punctuation, sentence case.
 * Ported from the lab2scale Design System (components/button).
 */
export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "style"> {
  /** primary = blue fill (max one per view) · secondary = hairline border · ghost = text only */
  variant?: "primary" | "secondary" | "ghost";
  style?: React.CSSProperties;
}

const base: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: "15px",
  fontWeight: 500,
  lineHeight: "1",
  height: "40px",
  padding: "0 16px",
  borderRadius: "var(--radius-control)",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  transition:
    "background 120ms cubic-bezier(0.16,1,0.3,1), border-color 120ms cubic-bezier(0.16,1,0.3,1), transform 120ms cubic-bezier(0.16,1,0.3,1)",
  border: "1px solid transparent",
  userSelect: "none",
};

export function Button({
  variant = "primary",
  disabled = false,
  children,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [press, setPress] = useState(false);

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: hover ? "var(--action-hover)" : "var(--action)",
      color: "#FFFFFF",
    },
    secondary: {
      background: hover ? "var(--neutral-100)" : "transparent",
      border: `1px solid ${hover ? "var(--border-hover)" : "var(--border)"}`,
      color: "var(--text-body)",
    },
    ghost: {
      background: hover ? "var(--neutral-100)" : "transparent",
      color: "var(--text-body)",
    },
  };

  return (
    <button
      {...rest}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPress(false);
      }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{
        ...base,
        ...variants[variant],
        transform: press ? "scale(0.98)" : "none",
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? "none" : "auto",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
