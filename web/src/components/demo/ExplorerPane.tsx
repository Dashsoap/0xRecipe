"use client";

import * as React from "react";
import { LinkSimple } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";

/**
 * Explorer pane - the on-chain window. Double-Bezel glass framing a recessed
 * viewport. Until a real settlement transaction exists the viewport shows an
 * elegant waiting state ("等待结算交易") with a thin link motif and a soft
 * breathing pulse. The frame holds its size via a plain sized div, so no
 * empty iframe ships. The real explorer iframe mounts only when a settlement
 * transaction URL is available.
 */
export function ExplorerPane() {
  return (
    <GlassPanel
      glow="none"
      className="h-full transition-colors duration-700 ease-spring hover:ring-white/15"
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
        {/* Sized waiting viewport - a plain div holds the frame dimensions; no
            empty iframe ships. The real explorer iframe mounts here only once a
            settlement transaction URL exists. No fabricated transaction data. */}
        <div className="relative flex min-h-[20rem] flex-1 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-ink-base px-6 text-center ring-1 ring-white/[0.07]">
          <WaitingMark />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-white/80">等待结算交易</p>
            <p className="text-xs leading-relaxed text-white/40">
              下一笔调用结算后,
              <br className="hidden sm:block" />
              交易将在此实时呈现
            </p>
          </div>
        </div>
      </div>
    </GlassPanel>
  );
}

/** Thin link glyph with a soft breathing pulse - the single focal hint in an
 * otherwise empty pane, signalling an on-chain stream that has not started. */
function WaitingMark() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-violet/10 ring-1 ring-violet/25">
      <div className="absolute inset-0 animate-pulse-glow rounded-full shadow-glow-violet" />
      <LinkSimple
        weight="light"
        className="relative h-6 w-6 text-violet"
        aria-hidden
      />
    </div>
  );
}
