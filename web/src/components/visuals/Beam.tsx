import * as React from "react";

import { cn } from "@/lib/utils";

type BeamColor = "cyan" | "violet" | "emerald";

const trackColor: Record<BeamColor, string> = {
  cyan: "rgba(34,211,238,0.18)",
  violet: "rgba(139,92,246,0.18)",
  emerald: "rgba(52,211,153,0.18)",
};

const beamColor: Record<BeamColor, string> = {
  cyan: "rgba(34,211,238,0.9)",
  violet: "rgba(139,92,246,0.9)",
  emerald: "rgba(52,211,153,0.9)",
};

export interface BeamProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: BeamColor;
  /** Track orientation. Horizontal is the default funds-flow rail. */
  orientation?: "horizontal" | "vertical";
  /** Show the faint static track behind the travelling light. */
  showTrack?: boolean;
}

/**
 * A thin rail with a light pulse travelling along it — the signature
 * "funds-flow" motif. Reused between agent → contract → creator in the demo
 * and as accents on cards. Animates via the `beam` keyframe (transform/opacity
 * only). Vertical orientation rotates the whole rail.
 */
export function Beam({
  color = "cyan",
  orientation = "horizontal",
  showTrack = true,
  className,
  style,
  ...props
}: BeamProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      style={{
        backgroundColor: showTrack ? trackColor[color] : "transparent",
        ...style,
      }}
      {...props}
    >
      <div
        className="absolute inset-0 animate-beam"
        style={{
          backgroundImage: `linear-gradient(${
            orientation === "horizontal" ? "90deg" : "180deg"
          }, transparent, ${beamColor[color]}, transparent)`,
        }}
      />
    </div>
  );
}
