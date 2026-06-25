import * as React from "react";

/**
 * hero-icons — hand-drawn thin-line (stroke 1.25) glyphs for the Hero feature
 * cards. Kept local to the Hero so they don't collide with the demo. Match the
 * design-system icon language (no heavy Lucide/Material strokes).
 */

type IconProps = { className?: string };

function base(className?: string) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.25,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
}

/** Key-with-slash — "no key needed" / keyless access. */
export function HeroKeyIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="8" cy="15" r="3.5" />
      <path d="M10.5 12.5 19 4" />
      <path d="M16 7l2 2" />
      <path d="M14 9l1.5 1.5" />
      <path d="M5 5l14 14" opacity="0.55" />
    </svg>
  );
}

/** Split arrows — atomic revenue split into two streams. */
export function HeroSplitIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 12h6" />
      <path d="M10 12c4 0 4 -6 9 -6" />
      <path d="M10 12c4 0 4 6 9 6" />
      <path d="M16 3l3 3-3 3" />
      <path d="M16 15l3 3-3 3" />
    </svg>
  );
}

/** Layered nodes converging — multi-model fusion. */
export function HeroFusionIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="6" cy="6" r="2.25" />
      <circle cx="6" cy="18" r="2.25" />
      <circle cx="18.5" cy="12" r="2.5" />
      <path d="M8 7l8 4" />
      <path d="M8 17l8 -4" />
    </svg>
  );
}
