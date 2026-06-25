import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressTone = "cyan" | "violet" | "emerald";

const fillClass: Record<ProgressTone, string> = {
  cyan: "bg-gradient-to-r from-cyan/70 to-cyan shadow-glow-cyan",
  violet: "bg-gradient-to-r from-violet/70 to-violet shadow-glow-violet",
  emerald: "bg-gradient-to-r from-emerald/70 to-emerald shadow-glow-emerald",
};

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Clamped to that range. */
  value?: number;
  /** Accent of the neon fill. */
  tone?: ProgressTone;
}

/**
 * Progress — Ethereal-Glass. A recessed hairline track with a glowing neon
 * fill that slides in on the spring curve. API mirrors the old
 * `<Progress value={...} />`; `tone` picks the accent.
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, tone = "cyan", ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/5",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full rounded-full transition-transform duration-700 ease-spring",
            fillClass[tone],
          )}
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
