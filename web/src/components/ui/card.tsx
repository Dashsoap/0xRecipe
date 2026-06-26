import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Card — Ethereal-Glass Double-Bezel. Same export API as before (Card,
 * CardHeader, CardTitle, CardDescription, CardContent, CardFooter) so existing
 * call sites keep working; only the look changes.
 *
 * The outer <div> is the bezel shell (translucent + hairline ring + 1.5 pad);
 * an inner core carries the dark surface, inset highlight and content radius.
 */
type CardGlow = "none" | "cyan" | "violet" | "emerald";
const CARD_GLOW: Record<CardGlow, string> = {
  none: "hover:ring-white/20",
  cyan: "hover:shadow-glow-cyan",
  violet: "hover:shadow-glow-violet",
  emerald: "hover:shadow-glow-emerald",
};

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Hover glow accent. Defaults to a neutral ring so the generic Card stays
   *  reusable in any accent context; pass an accent only for a focal card. */
  glow?: CardGlow;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, glow = "none", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-squircle bg-white/[0.03] p-1.5 ring-1 ring-white/10 transition-all duration-500 ease-spring",
        CARD_GLOW[glow],
        className,
      )}
      {...props}
    >
      <div className="h-full rounded-squircle-inner bg-ink-panel text-card-foreground shadow-inset-hi">
        {children}
      </div>
    </div>
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-lg font-medium leading-none tracking-tight text-white",
      className,
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
