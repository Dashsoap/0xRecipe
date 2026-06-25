"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * FlowDiagram — the signature funds-flow animation.
 *
 * Tells the on-chain payment story in one glance: a stablecoin payment leaves
 * the agent wallet, lands in a pre-paid escrow, and the splitter atomically
 * forks it into two streams — 80% to the creator, 20% to the platform.
 *
 * Built as a single responsive SVG with framer-motion glowing tokens that
 * travel along the connector paths on a slow, restrained loop. Each token
 * pulses its destination node on arrival. The splitter fork visibly branches
 * into an 80 / 20 split. Honours prefers-reduced-motion (static diagram).
 *
 * Pure visual — every label here is a generic flow term, no business entities.
 */

// Signature spring curve, shared with the design-system `ease-spring` token.
const SPRING = [0.32, 0.72, 0, 1] as const;

// --- Geometry (viewBox 0 0 920 360) --------------------------------------
const VB_W = 920;
const VB_H = 360;

// Node centres laid out left → right; splitter forks vertically on the right.
const NODES = {
  wallet: { x: 110, y: 180 },
  escrow: { x: 360, y: 180 },
  splitter: { x: 560, y: 180 },
  creator: { x: 810, y: 96 },
  platform: { x: 810, y: 264 },
} as const;

type NodeKey = keyof typeof NODES;

// Connector paths between node centres. Cubic curves for the splitter fork so
// the 80 / 20 streams arc apart organically.
const PATHS = {
  walletEscrow: `M ${NODES.wallet.x + 56} ${NODES.wallet.y} L ${NODES.escrow.x - 64} ${NODES.escrow.y}`,
  escrowSplitter: `M ${NODES.escrow.x + 64} ${NODES.escrow.y} L ${NODES.splitter.x - 56} ${NODES.splitter.y}`,
  splitterCreator: `M ${NODES.splitter.x + 56} ${NODES.splitter.y - 8} C ${NODES.splitter.x + 150} ${NODES.splitter.y - 20}, ${NODES.creator.x - 150} ${NODES.creator.y + 20}, ${NODES.creator.x - 64} ${NODES.creator.y}`,
  splitterPlatform: `M ${NODES.splitter.x + 56} ${NODES.splitter.y + 8} C ${NODES.splitter.x + 150} ${NODES.splitter.y + 20}, ${NODES.platform.x - 150} ${NODES.platform.y - 20}, ${NODES.platform.x - 64} ${NODES.platform.y}`,
} as const;

type Tone = "cyan" | "violet" | "emerald";

const TONE_HEX: Record<Tone, string> = {
  cyan: "#22D3EE",
  violet: "#8B5CF6",
  emerald: "#34D399",
};

export function FlowDiagram({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // Drive a single shared loop clock so every segment stays in phase. The
  // payment hops segment-by-segment, then the splitter forks into two streams.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 3600);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div
      className={cn("relative w-full", className)}
      role="img"
      aria-label="资金流动示意：智能体钱包付款，进入预付托管，由合约原子分账，八成给创作者、两成给平台"
    >
      {/* Localised glow behind the rails — keeps the SVG floating on dark. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 mx-auto max-w-[60%] rounded-full blur-[90px]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(34,211,238,0.10), transparent 70%)",
        }}
      />

      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full"
        fill="none"
        aria-hidden
      >
        <defs>
          {/* Soft glow filter for travelling tokens. */}
          <filter id="flow-glow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {(Object.keys(TONE_HEX) as Tone[]).map((tone) => (
            <radialGradient
              id={`flow-token-${tone}`}
              key={tone}
              cx="50%"
              cy="50%"
              r="50%"
            >
              <stop offset="0%" stopColor={TONE_HEX[tone]} stopOpacity="1" />
              <stop
                offset="100%"
                stopColor={TONE_HEX[tone]}
                stopOpacity="0.15"
              />
            </radialGradient>
          ))}
        </defs>

        {/* --- Static connector tracks (hairline) ------------------------- */}
        <g stroke="rgba(255,255,255,0.10)" strokeWidth={1.25}>
          <path d={PATHS.walletEscrow} />
          <path d={PATHS.escrowSplitter} />
          <path d={PATHS.splitterCreator} />
          <path d={PATHS.splitterPlatform} />
        </g>

        {/* --- Faint tinted overlay on the split streams ------------------ */}
        <path
          d={PATHS.splitterCreator}
          stroke="rgba(52,211,153,0.22)"
          strokeWidth={1.25}
        />
        <path
          d={PATHS.splitterPlatform}
          stroke="rgba(139,92,246,0.22)"
          strokeWidth={1.25}
        />

        {/* --- Travelling tokens ------------------------------------------ */}
        {!reduce ? (
          <FlowTokens tick={tick} />
        ) : null}
      </svg>

      {/* --- Node cards (HTML overlay, positioned in % of the viewBox) ---- */}
      <NodeCard
        node="wallet"
        tone="cyan"
        eyebrow="来源"
        title="智能体钱包"
        sub="0xDEMO · 稳定币"
        active={!reduce && tick % 4 === 0}
      />
      <NodeCard
        node="escrow"
        tone="cyan"
        eyebrow="预付"
        title="托管账户"
        sub="按调用预存"
        active={!reduce && tick % 4 === 1}
      />
      <NodeCard
        node="splitter"
        tone="violet"
        eyebrow="合约"
        title="原子分账"
        sub="一笔到账即分流"
        active={!reduce && tick % 4 === 2}
      />
      <NodeCard
        node="creator"
        tone="emerald"
        eyebrow="80%"
        title="创作者"
        sub="模型 / 配方收益"
        active={!reduce && tick % 4 === 3}
      />
      <NodeCard
        node="platform"
        tone="violet"
        eyebrow="20%"
        title="平台"
        sub="网络与结算"
        active={!reduce && tick % 4 === 3}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Travelling tokens — one per segment, sequenced over a 3.6s loop.          */
/* ------------------------------------------------------------------------ */

function FlowTokens({ tick }: { tick: number }) {
  // `tick` only re-seeds React; the actual motion is CSS-spring offset paths.
  // Each segment runs the same loop but with a staggered begin so the payment
  // appears to hop along, then fork. We key on `tick` to retrigger cleanly.
  return (
    <g key={tick}>
      <Token path={PATHS.walletEscrow} tone="cyan" delay={0} />
      <Token path={PATHS.escrowSplitter} tone="cyan" delay={0.85} />
      <Token path={PATHS.splitterCreator} tone="emerald" delay={1.75} />
      <Token path={PATHS.splitterPlatform} tone="violet" delay={1.75} />
    </g>
  );
}

function Token({
  path,
  tone,
  delay,
}: {
  path: string;
  tone: Tone;
  delay: number;
}) {
  // A single motion group travels along the connector via CSS motion-path
  // (transform-only), fading in at the start and out on arrival so the token
  // appears to "land" at the destination node.
  return (
    <motion.g
      initial={{ opacity: 0, offsetDistance: "0%" }}
      animate={{
        opacity: [0, 1, 1, 0],
        offsetDistance: ["0%", "100%"],
      }}
      transition={{
        duration: 0.85,
        delay,
        ease: SPRING,
        opacity: { duration: 0.85, delay, times: [0, 0.16, 0.82, 1], ease: SPRING },
      }}
      style={{ offsetPath: `path('${path}')`, offsetRotate: "0deg" } as React.CSSProperties}
    >
      <circle r={5.5} fill={`url(#flow-token-${tone})`} filter="url(#flow-glow)" />
      <circle r={2.2} fill="#ffffff" fillOpacity={0.9} />
    </motion.g>
  );
}

/* ------------------------------------------------------------------------ */
/* Node card — Double-Bezel glass chip, absolutely placed over the SVG.      */
/* ------------------------------------------------------------------------ */

const TONE_RING: Record<Tone, string> = {
  cyan: "ring-cyan/30",
  violet: "ring-violet/30",
  emerald: "ring-emerald/30",
};
const TONE_TEXT: Record<Tone, string> = {
  cyan: "text-cyan",
  violet: "text-violet",
  emerald: "text-emerald",
};
const TONE_GLOW: Record<Tone, string> = {
  cyan: "shadow-glow-cyan",
  violet: "shadow-glow-violet",
  emerald: "shadow-glow-emerald",
};

function NodeCard({
  node,
  tone,
  eyebrow,
  title,
  sub,
  active,
}: {
  node: NodeKey;
  tone: Tone;
  eyebrow: string;
  title: string;
  sub: string;
  active: boolean;
}) {
  const { x, y } = NODES[node];
  return (
    <motion.div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${(x / VB_W) * 100}%`, top: `${(y / VB_H) * 100}%` }}
      animate={{ scale: active ? 1.04 : 1 }}
      transition={{ duration: 0.6, ease: SPRING }}
    >
      <div
        className={cn(
          "rounded-[1rem] bg-white/[0.03] p-1 ring-1 ring-white/10 transition-shadow duration-700 ease-spring",
          active ? TONE_GLOW[tone] : "",
        )}
      >
        <div
          className={cn(
            "min-w-[6.5rem] rounded-[calc(1rem-0.25rem)] bg-ink-raised px-3 py-2.5 shadow-inset-hi ring-1",
            active ? TONE_RING[tone] : "ring-white/5",
          )}
        >
          <div
            className={cn(
              "font-mono text-[9px] uppercase tracking-[0.18em]",
              TONE_TEXT[tone],
            )}
          >
            {eyebrow}
          </div>
          <div className="mt-1 text-[13px] font-medium leading-tight text-white">
            {title}
          </div>
          <div className="mt-0.5 font-mono text-[10px] leading-tight text-white/45">
            {sub}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
