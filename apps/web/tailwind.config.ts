import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // OKLCH tokens from app/globals.css (alpha via <alpha-value>)
        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          hover: "oklch(var(--destructive-hover) / <alpha-value>)",
        },
        success: "oklch(var(--success) / <alpha-value>)",
        warning: "oklch(var(--warning) / <alpha-value>)",
        link: "oklch(var(--link) / <alpha-value>)",
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",
        "chart-1": "oklch(var(--chart-1) / <alpha-value>)",
        "chart-2": "oklch(var(--chart-2) / <alpha-value>)",
        "chart-3": "oklch(var(--chart-3) / <alpha-value>)",
        "chart-4": "oklch(var(--chart-4) / <alpha-value>)",
        "chart-5": "oklch(var(--chart-5) / <alpha-value>)",
      },
      // Spec radius: 0.375rem for standard surfaces
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.375rem",
        md: "0.375rem",
        lg: "0.375rem",
        xl: "0.375rem",
        "2xl": "0.5rem",
      },
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        serif: ["Georgia", "serif"],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "monospace",
        ],
      },
      // Spec: tracking 0.00em everywhere
      letterSpacing: {
        tighter: "0em",
        tight: "0em",
        normal: "0em",
        wide: "0em",
        wider: "0em",
        widest: "0em",
      },
      // Spec shadow: 0 4px 8px -1px hsl(0 0% 0% / 0.10)
      boxShadow: {
        sm: "0 1px 2px hsl(var(--shadow-color) / 0.1)",
        DEFAULT: "0 4px 8px -1px hsl(var(--shadow-color) / 0.1)",
        md: "0 4px 8px -1px hsl(var(--shadow-color) / 0.1)",
        lg: "0 4px 8px -1px hsl(var(--shadow-color) / 0.1)",
        xl: "0 4px 8px -1px hsl(var(--shadow-color) / 0.1)",
        "2xl": "0 4px 8px -1px hsl(var(--shadow-color) / 0.1)",
        none: "none",
      },
      // Entry animations used by dialog/sheet/tooltip (no plugin needed)
      keyframes: {
        "fade-in-0": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "fade-in-50": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "zoom-in-95": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in-0": "fade-in-0 100ms ease-out",
        "fade-in-50": "fade-in-50 150ms ease-out",
        "zoom-in-95": "zoom-in-95 100ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
