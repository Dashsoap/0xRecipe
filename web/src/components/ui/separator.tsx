import * as React from "react";

import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  /** Fade the hairline out at both ends (default) vs. a flat solid line. */
  faded?: boolean;
}

/**
 * Separator — Ethereal-Glass hairline. By default the line fades into nothing
 * at both ends (a gradient stroke) so it reads as a soft seam rather than a
 * hard rule. API stays compatible with the old Separator.
 */
const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ className, orientation = "horizontal", faded = true, ...props }, ref) => (
    <div
      ref={ref}
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        faded
          ? orientation === "horizontal"
            ? "bg-gradient-to-r from-transparent via-white/10 to-transparent"
            : "bg-gradient-to-b from-transparent via-white/10 to-transparent"
          : "bg-white/10",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };
