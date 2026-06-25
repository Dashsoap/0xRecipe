import * as React from "react";

import { cn } from "@/lib/utils";
import { GlowOrb } from "./GlowOrb";

/**
 * Fixed, full-viewport ambient background: a deep ink base with a cyan glow
 * orb top-left and a violet orb bottom-right, both heavily blurred and slowly
 * drifting. Sits beneath all content (-z) and never intercepts pointer events.
 */
export function MeshBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ink-base mesh-bg",
        className,
      )}
    >
      <GlowOrb
        color="cyan"
        size="44rem"
        drift
        className="-left-40 -top-48 opacity-80"
      />
      <GlowOrb
        color="violet"
        size="42rem"
        drift
        className="-bottom-48 -right-40 opacity-80 [animation-delay:-7s]"
      />
      {/* Faint vignette to settle the edges into the ink floor. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_0%,transparent_55%,#050507_100%)]" />
    </div>
  );
}
