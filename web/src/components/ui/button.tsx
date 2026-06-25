import * as React from "react";

import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default" // alias of primary (kept for back-compat)
  | "primary"
  | "secondary"
  | "ghost"
  | "outline" // alias of secondary
  | "destructive"
  | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  // Primary: cyan-tinted glass pill that glows on hover.
  default:
    "bg-cyan/10 text-cyan ring-1 ring-cyan/30 hover:bg-cyan/15 hover:shadow-glow-cyan",
  primary:
    "bg-cyan/10 text-cyan ring-1 ring-cyan/30 hover:bg-cyan/15 hover:shadow-glow-cyan",
  secondary:
    "bg-white/[0.04] text-white ring-1 ring-white/10 hover:bg-white/[0.07] hover:ring-white/20",
  outline:
    "bg-white/[0.04] text-white ring-1 ring-white/10 hover:bg-white/[0.07] hover:ring-white/20",
  ghost: "text-white/80 hover:bg-white/[0.05] hover:text-white",
  destructive:
    "bg-red-500/10 text-red-300 ring-1 ring-red-400/30 hover:bg-red-500/15",
  link: "text-cyan underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-10 px-5 py-2 text-sm",
  sm: "h-8 px-4 text-xs",
  lg: "h-12 px-7 text-base",
  icon: "h-10 w-10",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render a trailing arrow inside its own circular wrapper (Button-in-Button).
   * The arrow nudges on hover. Use for the primary call-to-action.
   */
  withArrow?: boolean;
}

/**
 * Button — Ethereal-Glass. Pill shape, magnetic hover (scale up on hover,
 * down on active) on the signature spring curve, coloured glow instead of a
 * black drop shadow, and an optional Button-in-Button trailing arrow.
 *
 * API stays compatible with the old shadcn-style Button (variant/size, plus
 * `default`/`outline` aliases) so existing call sites don't break.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "default",
      withArrow = false,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium",
          "transition-[transform,box-shadow,background-color] duration-500 ease-spring",
          "hover:scale-[1.02] active:scale-[0.98]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60",
          "disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          withArrow && "pr-1.5", // tuck the arrow wrapper toward the edge
          className,
        )}
        {...props}
      >
        {children}
        {withArrow ? (
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ease-spring group-hover:translate-x-1 group-hover:-translate-y-px group-hover:scale-105"
          >
            <ArrowUpRight className="h-4 w-4" />
          </span>
        ) : null}
      </button>
    );
  },
);
Button.displayName = "Button";

/** Hand-drawn thin (1.25) arrow — matches the icon language. */
function ArrowUpRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export { Button };
