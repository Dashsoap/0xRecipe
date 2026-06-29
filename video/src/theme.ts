/**
 * 0xRecipe explainer — design tokens.
 *
 * Violet dark-glass aesthetic (matches the product's web): deep indigo ground,
 * flowing violet/lavender gradient shapes, emerald for "money in" / creator
 * earnings, cyan as a cool accent. Type is white, tight, bold — read at a
 * glance from the full 1920x1080 frame.
 */

export const COLORS = {
  ink0: "#07060f",
  ink1: "#0e0b22",
  ink2: "#171042",
  ink3: "#241a5e",
  violet: "#8b5cf6",
  violetBright: "#a78bfa",
  lavender: "#c4b5fd",
  cyan: "#22d3ee",
  emerald: "#34d399",
  emeraldDeep: "#10b981",
  white: "#ffffff",
  textDim: "rgba(255,255,255,0.62)",
  textFaint: "rgba(255,255,255,0.40)",
  glassBg: "rgba(255,255,255,0.045)",
  glassRing: "rgba(255,255,255,0.10)",
} as const;

// System font stack — no network dependency at render time, clean grotesque.
export const FONT =
  '-apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", Inter, Arial, sans-serif';
export const MONO =
  'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';

// Type scale for a 1920px-wide composition (video-readable minimums, scaled up).
export const TYPE = {
  eyebrow: 30,
  display: 168,
  headline: 124,
  title: 84,
  body: 56,
  label: 40,
  small: 32,
} as const;

export const SAFE = 160; // safe-area inset from frame edges
