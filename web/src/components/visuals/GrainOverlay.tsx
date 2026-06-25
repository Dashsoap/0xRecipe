import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Fixed, full-viewport film grain. Tiled SVG noise (data-uri, defined as the
 * `.grain-overlay` helper in globals.css) at very low opacity. Sits above the
 * mesh but below content; never intercepts pointer events.
 */
export function GrainOverlay({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 grain-overlay opacity-[0.025] mix-blend-soft-light",
        className,
      )}
    />
  );
}
