"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Reveal } from "@/components/visuals/Reveal";
import { GlowOrb } from "@/components/visuals/GlowOrb";
import { FlowDiagram } from "@/components/visuals/FlowDiagram";
import { cn } from "@/lib/utils";
import {
  HeroKeyIcon,
  HeroSplitIcon,
  HeroFusionIcon,
} from "@/components/sections/hero-icons";

/**
 * Hero — centered editorial first surface (id="top").
 *
 * Stack: eyebrow pill → oversized bilingual headline → sub-copy → two
 * Button-in-Button CTAs → trust row → the signature funds-flow animation →
 * three glass bento feature cards. Everything enters on scroll via Reveal.
 *
 * Copy is strictly user-perspective: keyless / no-signup, pay-per-call in
 * stablecoin, on-chain atomic split, multi-model fusion. No internal terms,
 * no vendor names, no real entities. Demo values are labelled / use 0xDEMO.
 */

const FEATURES = [
  {
    icon: HeroKeyIcon,
    glow: "cyan" as const,
    eyebrow: "免门槛",
    title: "免 Key · 免注册 · 按调用付费",
    body: "智能体直接发起调用，不用申请密钥、不用开账号。用链上稳定币按次结算，调多少付多少。",
  },
  {
    icon: HeroSplitIcon,
    glow: "violet" as const,
    eyebrow: "链上结算",
    title: "原子分账 · 80 / 20",
    body: "每一笔付款在合约里一步到账即分流：八成给模型与配方的创作者，两成留给平台，全程可查。",
  },
  {
    icon: HeroFusionIcon,
    glow: "emerald" as const,
    eyebrow: "更优答案",
    title: "多模型融合 · 结构化结论",
    body: "同一道题汇聚多个模型的视角，合成为一份结构化结论，比单模型更稳、更可用。",
  },
];

const TRUST = [
  { label: "Injective EVM 测试网" },
  { label: "x402 付费协议" },
  { label: "稳定币结算" },
];

export function Hero() {
  return (
    <section
      id="top"
      aria-label="首屏"
      className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col items-center px-4 pb-24 pt-28 md:pb-40 md:pt-36"
    >
      {/* Localised hero glow — sits above the global mesh, below content. */}
      <GlowOrb
        color="cyan"
        size="40rem"
        drift
        className="left-1/2 top-[-6rem] -translate-x-1/2 opacity-70"
      />
      <GlowOrb
        color="violet"
        size="34rem"
        className="bottom-[-8rem] right-[-6rem] opacity-50"
      />

      {/* --- Headline cluster ------------------------------------------- */}
      <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
        <Reveal>
          <Badge variant="eyebrow">Injective · x402 · On-Chain AI</Badge>
        </Reveal>

        <Reveal delay={0.08} className="mt-6">
          <h1 className="text-balance text-5xl font-medium leading-[1.04] tracking-tight text-white sm:text-6xl md:text-7xl">
            让智能体直接
            <span className="relative whitespace-nowrap">
              {" "}
              <span className="bg-gradient-to-r from-cyan via-cyan to-violet bg-clip-text text-transparent">
                按调用付费
              </span>
            </span>
            <br className="hidden sm:block" /> 调用多模型融合
          </h1>
        </Reveal>

        <Reveal delay={0.16} className="mt-6">
          <p className="text-balance text-base leading-relaxed text-white/55 sm:text-lg">
            免密钥、免注册，用链上稳定币按次调用多个模型合成结论。
            <br className="hidden md:block" />
            每笔付款经合约原子分账，实时分给创作者与平台。
          </p>
        </Reveal>

        {/* CTAs */}
        <Reveal delay={0.24} className="mt-9">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button size="lg" withArrow>
              获取调用权限
            </Button>
            <DemoLink />
          </div>
        </Reveal>

        {/* Trust row */}
        <Reveal delay={0.32} className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {TRUST.map((t, i) => (
              <React.Fragment key={t.label}>
                {i > 0 ? (
                  <span
                    aria-hidden
                    className="hidden h-1 w-1 rounded-full bg-white/20 sm:block"
                  />
                ) : null}
                <span className="font-mono text-xs tracking-tight text-white/40">
                  {t.label}
                </span>
              </React.Fragment>
            ))}
          </div>
        </Reveal>
      </div>

      {/* --- Signature funds-flow animation ----------------------------- */}
      <Reveal delay={0.1} y={32} className="mt-16 w-full md:mt-24">
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

      {/* --- Bento feature cards ---------------------------------------- */}
      <div className="mt-12 grid w-full max-w-5xl grid-cols-1 gap-4 md:mt-16 md:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={0.08 * i} y={28}>
            <FeatureCard {...f} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/**
 * Secondary CTA rendered as an <a> (anchors to #demo). Mirrors the Button
 * secondary variant + Button-in-Button arrow visually, since the Button
 * primitive renders a <button> and can't legally wrap an anchor.
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
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <path d="M12 5v14" />
          <path d="m5 12 7 7 7-7" />
        </svg>
      </span>
    </a>
  );
}

const ICON_TONE = {
  cyan: { ring: "ring-cyan/30", text: "text-cyan", bg: "bg-cyan/10" },
  violet: { ring: "ring-violet/30", text: "text-violet", bg: "bg-violet/10" },
  emerald: { ring: "ring-emerald/30", text: "text-emerald", bg: "bg-emerald/10" },
} as const;

function FeatureCard({
  icon: Icon,
  glow,
  eyebrow,
  title,
  body,
}: (typeof FEATURES)[number]) {
  const tone = ICON_TONE[glow];
  return (
    <GlassPanel
      className="group h-full transition-shadow duration-700 ease-spring hover:shadow-glow-cyan"
      innerClassName="flex h-full flex-col gap-4 p-6"
    >
      <div
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-2xl ring-1",
          tone.bg,
          tone.ring,
        )}
      >
        <Icon className={cn("h-5 w-5", tone.text)} />
      </div>

      <div className="flex flex-col gap-2">
        <span
          className={cn(
            "font-mono text-[10px] uppercase tracking-[0.18em]",
            tone.text,
          )}
        >
          {eyebrow}
        </span>
        <h3 className="text-balance text-lg font-medium leading-snug tracking-tight text-white">
          {title}
        </h3>
        <p className="text-sm leading-relaxed text-white/50">{body}</p>
      </div>
    </GlassPanel>
  );
}
