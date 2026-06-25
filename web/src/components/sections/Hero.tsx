"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowsMerge,
  ArrowsSplit,
  Keyhole,
  type Icon,
} from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Reveal } from "@/components/visuals/Reveal";
import { FlowDiagram } from "@/components/visuals/FlowDiagram";
import { cn } from "@/lib/utils";

/**
 * Hero — centered editorial first surface (id="top").
 *
 * Stack: eyebrow pill -> headline (<=2 lines) -> sub-copy (<=2 lines) -> two
 * CTAs -> trust row -> the signature funds-flow animation -> an asymmetric
 * bento of feature cards. Everything enters on scroll via Reveal.
 *
 * Copy is strictly user-perspective: keyless / no-signup, pay-per-call in
 * stablecoin, on-chain atomic split, multi-model fusion. No internal terms,
 * no vendor names, no real entities. Demo values are labelled / use 0xDEMO.
 *
 * Icons are @phosphor-icons/react at one global weight ("light") + size. Glow
 * is reserved for focal elements only (primary CTA, the live funds-flow panel,
 * the wordmark dot) — resting feature cards stay quiet (hairline ring only).
 */

const ICON_WEIGHT = "light" as const;
const ICON_SIZE = 22;

export function Hero() {
  return (
    <section
      id="top"
      aria-label="首屏"
      className="relative mx-auto flex w-full max-w-7xl flex-col items-center px-4 pb-20 pt-20 md:pb-28 md:pt-24"
    >
      {/* Ambient cyan/violet glow comes from the global MeshBackground — no
          duplicate orbs here, so neon stays reserved for focal elements. */}

      {/* --- Headline cluster ------------------------------------------- */}
      <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
        <Reveal>
          <Badge variant="eyebrow">链上调用 · 按次结算</Badge>
        </Reveal>

        <Reveal delay={0.08} className="mt-6">
          <h1 className="text-balance text-5xl font-medium leading-[1.06] tracking-tight text-white sm:text-6xl md:text-7xl">
            让智能体<span className="text-cyan">按调用付费</span>
            <br className="hidden sm:block" /> 调用多模型融合
          </h1>
        </Reveal>

        <Reveal delay={0.16} className="mt-6">
          <p className="text-balance text-base leading-relaxed text-white/55 sm:text-lg">
            免密钥、免注册，用链上稳定币按次调用多个模型合成结论，
            <br className="hidden md:block" />
            每笔付款经合约原子分账，实时分给创作者与平台。
          </p>
        </Reveal>

        {/* CTAs — primary carries the only button glow. */}
        <Reveal delay={0.24} className="mt-9">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button size="lg" withArrow>
              开始调用
            </Button>
            <DemoLink />
          </div>
        </Reveal>

        {/* Trust row — one language register, metadata dots within budget. */}
        <Reveal delay={0.32} className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST.map((t, i) => (
              <React.Fragment key={t}>
                {i > 0 ? (
                  <span
                    aria-hidden
                    className="hidden h-1 w-1 rounded-full bg-white/20 sm:block"
                  />
                ) : null}
                <span className="font-mono text-xs tracking-tight text-white/40">
                  {t}
                </span>
              </React.Fragment>
            ))}
          </div>
        </Reveal>
      </div>

      {/* --- Signature funds-flow animation (the one glowing panel) ------ */}
      <Reveal id="how" delay={0.1} y={32} className="mt-12 w-full scroll-mt-24 md:mt-14">
        <GlassPanel
          glow="cyan"
          className="mx-auto w-full max-w-5xl"
          innerClassName="relative overflow-hidden px-4 py-10 sm:px-8 sm:py-14"
        >
          <div className="mb-7 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-pulse-glow rounded-full bg-emerald" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/45">
                一次调用的资金流向
              </span>
            </div>
            <Badge variant="default" className="font-mono text-[10px] text-white/40">
              演示数据 · 占位
            </Badge>
          </div>

          <FlowDiagram />
        </GlassPanel>
      </Reveal>

      {/* --- Asymmetric bento: 1 wide + 2 stacked --------------------- */}
      <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-4 md:mt-14 md:grid-cols-3">
        <Reveal y={28} className="md:col-span-2">
          <KeylessCard />
        </Reveal>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-1">
          <Reveal delay={0.08} y={28}>
            <SplitCard />
          </Reveal>
          <Reveal delay={0.16} y={28}>
            <FusionCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const TRUST = ["Injective EVM 测试网", "x402 付费协议", "稳定币结算"] as const;

/* ------------------------------------------------------------------------ */

/**
 * Secondary CTA rendered as an <a> (anchors to #demo). Mirrors the secondary
 * Button visually since the Button primitive renders a <button> and can't
 * legally wrap an anchor. No glow — that is reserved for the primary CTA.
 */
function DemoLink() {
  return (
    <a
      href="#demo"
      className={cn(
        "group inline-flex h-12 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full pl-7 pr-1.5 text-base font-medium",
        "bg-white/[0.04] text-white ring-1 ring-white/10",
        "transition-[transform,box-shadow,background-color] duration-500 ease-spring",
        "hover:scale-[1.02] hover:bg-white/[0.07] hover:ring-white/20 active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan/60",
      )}
    >
      看 Demo
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ease-spring group-hover:translate-y-1 group-hover:scale-105"
      >
        <ArrowDown weight={ICON_WEIGHT} size={16} />
      </span>
    </a>
  );
}

/* ------------------------------------------------------------------------ */
/* Bento cards — quiet resting state (hairline ring only). At least two cells
   carry a real visual motif beyond an icon chip. */

const ICON_TONE = {
  cyan: { ring: "ring-cyan/30", text: "text-cyan", bg: "bg-cyan/10" },
  violet: { ring: "ring-violet/30", text: "text-violet", bg: "bg-violet/10" },
  emerald: {
    ring: "ring-emerald/30",
    text: "text-emerald",
    bg: "bg-emerald/10",
  },
} as const;

function IconChip({
  icon: Icon,
  tone,
}: {
  icon: Icon;
  tone: keyof typeof ICON_TONE;
}) {
  const t = ICON_TONE[tone];
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1",
        t.bg,
        t.ring,
      )}
    >
      <Icon className={t.text} weight={ICON_WEIGHT} size={ICON_SIZE} />
    </div>
  );
}

/** Wide lead card — keyless, pay-per-call. */
function KeylessCard() {
  return (
    <GlassPanel
      className="h-full"
      innerClassName="flex h-full flex-col gap-5 p-6 sm:p-7"
    >
      <div className="flex items-start justify-between gap-4">
        <IconChip icon={Keyhole} tone="cyan" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan/80">
          免门槛
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-balance text-xl font-medium leading-snug tracking-tight text-white">
          免密钥免注册，按调用付费
        </h3>
        <p className="text-sm leading-relaxed text-white/50">
          智能体直接发起调用，不用申请密钥、不用开账号。用链上稳定币按次结算，调多少付多少。
        </p>
      </div>

      {/* Tiny pay-per-call meter — a real visual motif, not just an icon. */}
      <div className="mt-auto flex items-center gap-3 pt-2">
        <div className="flex flex-1 items-center gap-1.5">
          {[0.9, 0.55, 0.75, 0.4, 0.85, 0.5, 0.7].map((h, i) => (
            <span
              key={i}
              aria-hidden
              className="flex-1 rounded-full bg-cyan/30"
              style={{ height: `${6 + h * 18}px` }}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] tracking-tight text-white/35">
          按次计费
        </span>
      </div>
    </GlassPanel>
  );
}

/** Atomic split card — carries an 80 / 20 split mini-diagram. */
function SplitCard() {
  return (
    <GlassPanel
      className="h-full"
      innerClassName="flex h-full flex-col gap-4 p-6"
    >
      <div className="flex items-center gap-3">
        <IconChip icon={ArrowsSplit} tone="violet" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-violet/80">
          链上结算
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-balance text-lg font-medium leading-snug tracking-tight text-white">
          一笔付款，原子分账
        </h3>
        <p className="text-sm leading-relaxed text-white/50">
          每笔付款在合约里一步到账即分流，八成给创作者，两成留平台，全程可查。
        </p>
      </div>

      {/* 80 / 20 split bar. */}
      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        <div className="flex h-2 overflow-hidden rounded-full ring-1 ring-white/10">
          <span aria-hidden className="bg-violet/60" style={{ width: "80%" }} />
          <span aria-hidden className="bg-white/15" style={{ width: "20%" }} />
        </div>
        <div className="flex justify-between font-mono text-[10px] tracking-tight text-white/35">
          <span>创作者 80</span>
          <span>平台 20</span>
        </div>
      </div>
    </GlassPanel>
  );
}

/** Multi-model fusion card — converging-streams motif. */
function FusionCard() {
  return (
    <GlassPanel
      className="h-full"
      innerClassName="flex h-full flex-col gap-4 p-6"
    >
      <div className="flex items-center gap-3">
        <IconChip icon={ArrowsMerge} tone="emerald" />
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald/80">
          更优答案
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-balance text-lg font-medium leading-snug tracking-tight text-white">
          多模型融合，结构化结论
        </h3>
        <p className="text-sm leading-relaxed text-white/50">
          同一道题汇聚多个模型的视角，合成一份结构化结论，比单模型更稳、更可用。
        </p>
      </div>

      {/* Converging nodes motif. */}
      <div
        aria-hidden
        className="mt-auto flex items-center gap-2 pt-1 font-mono text-[10px] tracking-tight text-white/35"
      >
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald/60" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald/40" />
          <span className="h-1.5 w-1.5 rounded-full bg-emerald/25" />
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-emerald/40 to-transparent" />
        <span>合成一份</span>
      </div>
    </GlassPanel>
  );
}
