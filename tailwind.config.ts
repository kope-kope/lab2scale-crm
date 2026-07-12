import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * Design tokens live HERE (and in src/index.css as CSS variables) — this is the
 * single source of truth for color. Components must reference these token names,
 * never raw hex. Ramps are provisional until reconciled with
 * /Design System/lab2scale-design-system.md.
 *
 * Tailwind's default spacing scale is already a 4px scale, which the design
 * system assumes — so we keep it.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // --- Brand ramps (raw palette) ---
        blue: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bcd3ff",
          300: "#8eb6ff",
          400: "#598eff",
          500: "#3366f6",
          600: "#1f47eb",
          700: "#1a37d3",
          800: "#1b30aa",
          900: "#1c2f86",
          950: "#151d52",
        },
        midnight: {
          50: "#f4f6fb",
          100: "#e8ecf5",
          200: "#ccd6e8",
          300: "#9fb2d2",
          400: "#6b87b6",
          500: "#4a659c",
          600: "#394f82",
          700: "#2f406a",
          800: "#2a3859",
          900: "#0e1526",
          950: "#080c17",
        },
        sky: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#b9e5fe",
          300: "#7cd1fd",
          400: "#38bcf8",
          500: "#0ea2e9",
          600: "#0281c7",
          700: "#0369a1",
          800: "#075784",
          900: "#0c496d",
          950: "#082f49",
        },
        neutral: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020817",
        },

        // --- Semantic tokens (driven by CSS vars in index.css) ---
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
