import type { Config } from "tailwindcss";

/**
 * Ethereal-Glass design system — single source of truth for tokens.
 *
 * Dark-first, layered "ink" surfaces with restrained neon accents that glow on
 * a deep base. Everything else in the app (Tailwind classes used by sections
 * and primitives) reads from this map, so colours / radii / shadows / motion
 * stay consistent across surfaces.
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // --- Layered dark "ink" surfaces (page → panel → raised) ---------
        ink: {
          base: "#050507", // page floor
          panel: "#0a0b10", // resting panel / card body
          raised: "#101218", // elevated layer / inner-bezel core
          line: "rgba(255,255,255,0.08)", // hairline borders
        },
        // --- Neon accents (restrained, glow on dark, never large fills) ---
        cyan: {
          DEFAULT: "#22D3EE", // primary accent
          soft: "rgba(34,211,238,0.12)",
        },
        violet: {
          DEFAULT: "#8B5CF6", // secondary accent
          soft: "rgba(139,92,246,0.12)",
        },
        emerald: {
          DEFAULT: "#34D399", // success / settled
          soft: "rgba(52,211,153,0.12)",
        },
        // --- shadcn-compatible aliases (kept so existing call sites work) -
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
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        // Geist variables are injected on <html> in layout.tsx.
        sans: [
          "var(--font-geist-sans)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          "var(--font-geist-mono)",
          "ui-monospace",
          "SFMono-Regular",
          "monospace",
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Signature squircle for panels / hero cards.
        squircle: "2rem",
        // Inner core of a Double-Bezel (outer 2rem minus 1.5 padding = 0.375rem).
        "squircle-inner": "calc(2rem - 0.375rem)",
      },
      boxShadow: {
        // Coloured glows replace harsh black drop shadows.
        "glow-cyan": "0 0 40px -12px rgba(34,211,238,0.45)",
        "glow-violet": "0 0 40px -12px rgba(139,92,246,0.45)",
        "glow-emerald": "0 0 40px -12px rgba(52,211,153,0.45)",
        // Inset top highlight for Double-Bezel inner cores.
        "inset-hi": "inset 0 1px 0 rgba(255,255,255,0.06)",
        // Combined: subtle cyan glow + inset highlight for hero focal cards.
        "bezel-cyan":
          "inset 0 1px 0 rgba(255,255,255,0.06), 0 0 60px -20px rgba(34,211,238,0.4)",
      },
      backgroundImage: {
        // Hairline gradient strokes for borders / beams.
        "stroke-cyan":
          "linear-gradient(90deg, rgba(34,211,238,0) 0%, rgba(34,211,238,0.5) 50%, rgba(34,211,238,0) 100%)",
        "stroke-violet":
          "linear-gradient(90deg, rgba(139,92,246,0) 0%, rgba(139,92,246,0.5) 50%, rgba(139,92,246,0) 100%)",
      },
      transitionTimingFunction: {
        // Signature spring — use everywhere instead of linear / ease-in-out.
        spring: "cubic-bezier(0.32,0.72,0,1)",
      },
      transitionDuration: {
        "600": "600ms",
        "800": "800ms",
      },
      keyframes: {
        // Funds-flow light travelling along a track.
        beam: {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "10%": { opacity: "1" },
          "90%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        // Slow drift for the background glow orbs.
        float: {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "50%": { transform: "translate3d(2%,-3%,0) scale(1.06)" },
        },
        // Sweeping highlight across a surface.
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        // Breathing glow for live / active accents.
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        beam: "beam 2.4s cubic-bezier(0.32,0.72,0,1) infinite",
        float: "float 14s cubic-bezier(0.32,0.72,0,1) infinite",
        "float-slow": "float 20s cubic-bezier(0.32,0.72,0,1) infinite",
        shimmer: "shimmer 2.8s linear infinite",
        "pulse-glow": "pulse-glow 3s cubic-bezier(0.32,0.72,0,1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
