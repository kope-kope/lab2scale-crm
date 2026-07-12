import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

/**
 * lab2scale design system — Tailwind binding.
 *
 * All values resolve to the CSS variables vendored under
 * src/design-system/tokens/*. That vendored token CSS is the single source of
 * truth; this file only exposes it to Tailwind utilities. App code references
 * token-named utilities, never raw hex.
 *
 * Two rules are enforced structurally here:
 *  - the palette is closed (theme.colors is replaced, not extended) so no
 *    off-system gray/red can sneak in;
 *  - font weights are limited to 400/500, so `font-semibold` / `font-bold`
 *    generate nothing — the "never 600/700" rule can't be violated.
 */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",
      white: "#FFFFFF",
      black: "#000000",

      // Raw ramps
      blue: {
        50: "var(--blue-50)",
        100: "var(--blue-100)",
        200: "var(--blue-200)",
        300: "var(--blue-300)",
        400: "var(--blue-400)",
        500: "var(--blue-500)",
        600: "var(--blue-600)",
        700: "var(--blue-700)",
        800: "var(--blue-800)",
        900: "var(--blue-900)",
      },
      midnight: {
        50: "var(--midnight-50)",
        100: "var(--midnight-100)",
        200: "var(--midnight-200)",
        300: "var(--midnight-300)",
        400: "var(--midnight-400)",
        500: "var(--midnight-500)",
        600: "var(--midnight-600)",
        700: "var(--midnight-700)",
        800: "var(--midnight-800)",
        900: "var(--midnight-900)",
      },
      sky: {
        50: "var(--sky-50)",
        100: "var(--sky-100)",
        200: "var(--sky-200)",
        300: "var(--sky-300)",
        400: "var(--sky-400)",
        500: "var(--sky-500)",
        600: "var(--sky-600)",
        700: "var(--sky-700)",
        800: "var(--sky-800)",
        900: "var(--sky-900)",
      },
      neutral: {
        50: "var(--neutral-50)",
        100: "var(--neutral-100)",
        200: "var(--neutral-200)",
        300: "var(--neutral-300)",
        400: "var(--neutral-400)",
        500: "var(--neutral-500)",
        600: "var(--neutral-600)",
        700: "var(--neutral-700)",
        800: "var(--neutral-800)",
        900: "var(--neutral-900)",
      },

      // Semantic aliases (use these in app code)
      action: {
        DEFAULT: "var(--action)",
        hover: "var(--action-hover)",
        tint: "var(--action-tint)",
        text: "var(--action-text)",
      },
      page: "var(--page)",
      surface: {
        DEFAULT: "var(--surface)",
        dark: "var(--surface-dark)",
      },
      canvas: { dark: "var(--canvas-dark)" },
      border: {
        DEFAULT: "var(--border)",
        hover: "var(--border-hover)",
      },
      body: "var(--text-body)",
      muted: "var(--text-muted)",
      inverse: "var(--text-inverse)",
      success: {
        DEFAULT: "var(--success)",
        tint: "var(--success-tint)",
        text: "var(--success-text)",
      },
      warning: {
        DEFAULT: "var(--warning)",
        tint: "var(--warning-tint)",
        text: "var(--warning-text)",
      },
      danger: {
        DEFAULT: "var(--danger)",
        tint: "var(--danger-tint)",
        text: "var(--danger-text)",
      },
    },

    // Inter only, 400/500 only — 600/700 intentionally absent.
    fontWeight: {
      normal: "400",
      regular: "400",
      medium: "500",
    },

    // The type scale from the design system. Size keys are deliberately named
    // so none collides with a color key (avoids ambiguous `text-*` utilities);
    // `base` = body 15px, `lead` = body-lg 17px.
    fontSize: {
      caption: ["12px", { lineHeight: "1.4" }],
      small: ["13px", { lineHeight: "1.5" }],
      base: ["15px", { lineHeight: "1.6" }],
      lead: ["17px", { lineHeight: "1.6" }],
      h3: ["18px", { lineHeight: "1.4" }],
      h2: ["24px", { lineHeight: "1.3" }],
      h1: ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
      display: ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
    },

    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
      },
      borderColor: {
        DEFAULT: "var(--border)",
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        float: "var(--shadow-float)",
        none: "none",
      },
      transitionTimingFunction: {
        ds: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
