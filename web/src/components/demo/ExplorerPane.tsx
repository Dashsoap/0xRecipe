"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";

/**
 * Explorer pane — the on-chain window. Double-Bezel glass framing a recessed
 * viewport. Until a real settlement transaction exists the viewport shows an
 * elegant waiting state ("等待结算交易") with a thin block-link motif; the
 * about:blank iframe is kept mounted beneath so the frame has real dimensions.
 *
 * Once a settlement tx is available, point the iframe `src` at the testnet
 * block explorer's transaction page, e.g. explorerTxUrl(latestSettlement.txHash),
 * and hide the waiting overlay.
 */
export function ExplorerPane() {
  return (
    <GlassPanel
      glow="none"
      className="h-full transition-shadow duration-700 ease-spring hover:shadow-glow-violet"
      innerClassName="flex h-full flex-col p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-tight text-white">
            链上浏览器
          </h3>
          <p className="mt-1 text-sm text-white/50">结算交易实时查看</p>
        </div>
        <Badge variant="violet" className="shrink-0">
          链上
        </Badge>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="relative flex-1 overflow-hidden rounded-2xl bg-ink-base ring-1 ring-white/[0.07]">
          {/* Real viewport, kept mounted so the frame holds its size. */}
          <iframe
            title="链上浏览器"
            src="about:blank"
            aria-hidden
            tabIndex={-1}
            className="pointer-events-none h-full min-h-[20rem] w-full opacity-0"
          />

          {/* Elegant empty state — no fabricated transaction data. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <WaitingMark />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-white/80">
                等待结算交易
              </p>
              <p className="text-xs leading-relaxed text-white/40">
                下一笔调用结算后,
                <br className="hidden sm:block" />
                交易将在此实时呈现
              </p>
            </div>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

/** Thin hand-drawn block-link glyph with a soft breathing glow — signals an
 * on-chain stream that has not started yet. */
function WaitingMark() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-violet/10 ring-1 ring-violet/25">
      <div className="absolute inset-0 animate-pulse-glow rounded-full shadow-glow-violet" />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative h-6 w-6 text-violet"
        aria-hidden
      >
        <rect x="3" y="9" width="7" height="6" rx="1.5" />
        <rect x="14" y="9" width="7" height="6" rx="1.5" />
        <path d="M10 12h4" />
      </svg>
    </div>
  );
}
