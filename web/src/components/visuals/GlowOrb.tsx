import * as React from "react";

import { cn } from "@/lib/utils";

type OrbColor = "cyan" | "violet" | "emerald";

const colorMap: Record<OrbColor, string> = {
  cyan: "rgba(34,211,238,0.20)",
  violet: "rgba(139,92,246,0.20)",
  emerald: "rgba(52,211,153,0.18)",
};

export interface GlowOrbProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: OrbColor;
  /** CSS size, e.g. "32rem". Defaults to a large soft ball. */
  size?: string;
  /** Add a slow floating drift. */
  drift?: boolean;
}

/**
 * A single soft radial light ball. Heavily blurred, low opacity, no pointer
 * events. Composed by MeshBackground but also reusable inside cards/sections
 * to add a localised glow. Animates only transform/opacity.
 */
export function GlowOrb({
  color = "cyan",
  size = "32rem",
  drift = false,
  className,
  style,
  ...props
}: GlowOrbProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute rounded-full blur-[120px]",
        drift && "animate-float-slow",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: `radial-gradient(circle, ${colorMap[color]}, transparent 65%)`,
        ...style,
      }}
      {...props}
    />
  );
}
