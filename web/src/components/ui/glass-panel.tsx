import * as React from "react";

import { cn } from "@/lib/utils";

type GlowTone = "none" | "cyan" | "violet" | "emerald";

const glowClass: Record<GlowTone, string> = {
  none: "",
  cyan: "shadow-glow-cyan",
  violet: "shadow-glow-violet",
  emerald: "shadow-glow-emerald",
};

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional coloured glow around the whole panel. */
  glow?: GlowTone;
  /** Class names applied to the inner core (not the outer shell). */
  innerClassName?: string;
  /** Render as a different element via cloning is overkill — keep it a div. */
  asChild?: never;
}

/**
 * Double-Bezel glass primitive — the signature container for important cards.
 *
 * Structure:
 *   outer shell  -> bg-white/[0.03] + ring-white/10 + p-1.5 + rounded-squircle
 *   inner core   -> own dark bg + inset top highlight + rounded-squircle-inner
 *
 * Pass content as children; it renders inside the inner core. Use `glow` for a
 * coloured halo and `innerClassName` to tweak the core (e.g. padding/bg).
 */
const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ glow = "none", className, innerClassName, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-squircle bg-white/[0.03] p-1.5 ring-1 ring-white/10",
          glowClass[glow],
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "rounded-squircle-inner bg-ink-panel shadow-inset-hi",
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    );
  },
);
GlassPanel.displayName = "GlassPanel";

export { GlassPanel };
