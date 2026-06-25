import * as React from "react";

import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default" // neutral hairline pill
  | "eyebrow" // uppercase tracking pill placed above big headings
  | "cyan"
  | "violet"
  | "emerald"
  | "secondary" // alias of default (back-compat)
  | "outline" // alias of default (back-compat)
  | "destructive";

const variantClasses: Record<BadgeVariant, string> = {
  default:
    "bg-white/[0.04] text-white/80 ring-1 ring-white/10 px-2.5 py-0.5 text-xs",
  secondary:
    "bg-white/[0.04] text-white/80 ring-1 ring-white/10 px-2.5 py-0.5 text-xs",
  outline:
    "bg-white/[0.04] text-white/80 ring-1 ring-white/10 px-2.5 py-0.5 text-xs",
  // Eyebrow: small uppercase label for above hero/section headings.
  eyebrow:
    "bg-white/[0.04] text-white/70 ring-1 ring-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em]",
  cyan: "bg-cyan/10 text-cyan ring-1 ring-cyan/25 px-2.5 py-0.5 text-xs",
  violet:
    "bg-violet/10 text-violet ring-1 ring-violet/25 px-2.5 py-0.5 text-xs",
  emerald:
    "bg-emerald/10 text-emerald ring-1 ring-emerald/25 px-2.5 py-0.5 text-xs",
  destructive:
    "bg-red-500/10 text-red-300 ring-1 ring-red-400/25 px-2.5 py-0.5 text-xs",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

/**
 * Badge — Ethereal-Glass pill. `eyebrow` is the signature uppercase label that
 * sits above large headings; the colour variants tint the pill for status.
 * Default / secondary / outline all resolve to the neutral hairline pill so
 * legacy call sites keep working.
 */
function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full font-medium transition-colors duration-500 ease-spring",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
