"use client";

import { motion, useReducedMotion } from "framer-motion";

import { useMounted } from "@/hooks/useMounted";

import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Separator } from "@/components/ui/separator";
import { Beam } from "@/components/visuals/Beam";
import { GlowOrb } from "@/components/visuals/GlowOrb";
import { formatUsdc, shortenAddress } from "@/lib/format";

// Signature spring curve, shared with the Tailwind `ease-spring` token.
const SPRING = [0.32, 0.72, 0, 1] as const;

export interface CreatorPaneProps {
  address: `0x${string}`;
  /** Cumulative earnings, USDC base units. */
  totalEarned: string;
  /** Most recent payout share, USDC base units. */
  latestPayout: string;
  /** Whether a settlement exists to surface as "this split". */
  hasLatest: boolean;
}

/**
 * Creator pane - the earning side. Double-Bezel glass with an emerald accent:
 * payout address in mono, cumulative income, and a "this split" focal block
 * where the amount fades up with an emerald glow to celebrate an on-chain
 * arrival. The panel rests quiet (hairline ring only); the emerald glow is
 * reserved for the settled split, the one true focal moment here. Empty
 * state stays calm and waits for the next call.
 */
export function CreatorPane({
  address,
  totalEarned,
  latestPayout,
  hasLatest,
}: CreatorPaneProps) {
  return (
    <GlassPanel
      glow="none"
      className="h-full transition-colors duration-700 ease-spring hover:ring-white/15"
      innerClassName="relative flex h-full flex-col overflow-hidden p-6"
    >
      {/* Localised emerald wash behind the split block. */}
      {hasLatest ? (
        <GlowOrb
          color="emerald"
          size="22rem"
          className="-bottom-24 -right-16 opacity-60"
        />
      ) : null}

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-tight text-white">
            创作者视角
          </h3>
          <p className="mt-1 text-sm text-white/50">配方累计收入与本次分账</p>
        </div>
        <Badge variant="emerald" className="shrink-0">
          收款方
        </Badge>
      </div>

      <div className="relative mt-6 flex flex-1 flex-col gap-6">
        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            收款地址
          </div>
          <span className="font-mono text-sm text-white/85">
            {shortenAddress(address)}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            累计收入
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-semibold tracking-tight text-white">
              {formatUsdc(totalEarned)}
            </span>
            <span className="text-xs text-white/40">USDC</span>
          </div>
        </div>

        <Separator />

        <SplitBlock latestPayout={latestPayout} hasLatest={hasLatest} />
      </div>
    </GlassPanel>
  );
}

/** Focal "this split" panel. When a settlement exists the figure resolves up
 * with an emerald glow; otherwise it rests in a quiet waiting state. */
function SplitBlock({
  latestPayout,
  hasLatest,
}: {
  latestPayout: string;
  hasLatest: boolean;
}) {
  const reduce = useReducedMotion();
  // Defer the reduced-motion decision until after mount (no hydration mismatch).
  const reducedNow = useMounted() && reduce;

  return (
    <div className="relative mt-auto overflow-hidden rounded-2xl bg-emerald-soft p-4 ring-1 ring-emerald/25">
      {hasLatest ? (
        <Beam
          color="emerald"
          showTrack={false}
          className="absolute inset-x-4 top-0 opacity-70"
        />
      ) : null}
      <div className="text-[11px] uppercase tracking-[0.18em] text-emerald/70">
        本次分账
      </div>

      {hasLatest ? (
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <motion.span
            key={latestPayout}
            className="font-mono text-3xl font-semibold tracking-tight text-emerald drop-shadow-[0_0_18px_rgba(52,211,153,0.45)]"
            initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={
              reducedNow ? { duration: 0 } : { duration: 0.6, ease: SPRING }
            }
          >
            +{formatUsdc(latestPayout)}
          </motion.span>
          <span className="text-xs text-white/45">链上即时到账</span>
        </div>
      ) : (
        <p className="mt-1.5 text-sm text-white/45">等待下一次调用结算</p>
      )}
    </div>
  );
}
