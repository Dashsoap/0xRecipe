import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 0–100. Clamped to that range. */
  value?: number;
}

/**
 * Minimal shadcn-compatible Progress (no Radix dependency).
 * API mirrors shadcn's `<Progress value={...} />`.
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.max(0, Math.min(100, value));
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className,
        )}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-primary transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
