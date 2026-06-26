"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";

import { useMounted } from "@/hooks/useMounted";

import { cn } from "@/lib/utils";

/**
 * FlowDiagram — the signature funds-flow animation.
 *
 * Tells the on-chain payment story in one glance: a stablecoin payment leaves
 * the agent wallet, lands in a pre-paid escrow, and the splitter atomically
 * forks it into two streams — most to the platform, the rest to the creator.
 *
 * Everything (node chips AND connector rails) lives inside ONE SVG viewBox so
 * the two share a single coordinate system. Node chips render as
 * <foreignObject> boxes of a fixed viewBox size, and each connector endpoint is
 * derived from the chip's true edge midpoint — so the rails stay glued to the
 * node edges at any rendered width. Glowing tokens travel the rails on a slow,
 * restrained loop. Honours prefers-reduced-motion (static diagram).
 *
 * Pure visual — every label here is a generic flow term, no business entities.
 */

// Signature spring curve, shared with the design-system `ease-spring` token.
const SPRING = [0.32, 0.72, 0, 1] as const;

// --- One coordinate system (viewBox units) -------------------------------
const VB_W = 920;
const VB_H = 360;

// Every chip is the same fixed box in viewBox units. Because the chips live
// inside the SVG via <foreignObject>, this box scales with the rails — so an
// edge midpoint computed here is pixel-accurate at any rendered width.
const NODE_W = 132;
const NODE_H = 64;
const HALF_W = NODE_W / 2;

type Tone = "cyan" | "violet" | "emerald";

type NodeDef = {
  cx: number;
  cy: number;
  tone: Tone;
  eyebrow: string;
  title: string;
  sub: string;
};

// Node centres. The three main nodes are horizontally distributed and share
// y = 180 (the viewBox vertical centre); the splitter forks up/down on the
// right into the creator (top) and platform (bottom).
const NODES = {
  wallet: {
    cx: 90,
    cy: 180,
    tone: "cyan",
    eyebrow: "来源",
    title: "智能体钱包",
    sub: "0xDEMO · 稳定币",
  },
  escrow: {
    cx: 360,
    cy: 180,
    tone: "cyan",
    eyebrow: "预付",
    title: "托管账户",
    sub: "按调用预存",
  },
  splitter: {
    cx: 590,
    cy: 180,
    tone: "violet",
    eyebrow: "合约",
    title: "原子分账",
    sub: "一笔到账即分流",
  },
  creator: {
    cx: 830,
    cy: 92,
    tone: "emerald",
    eyebrow: "20%",
    title: "创作者",
    sub: "配方调用返佣",
  },
  platform: {
    cx: 830,
    cy: 268,
    tone: "violet",
    eyebrow: "80%",
    title: "平台",
    sub: "结算与算力成本",
  },
} satisfies Record<string, NodeDef>;

type NodeKey = keyof typeof NODES;

// Edge midpoints in the shared coordinate system.
const leftMid = (n: NodeDef) => ({ x: n.cx - HALF_W, y: n.cy });
const rightMid = (n: NodeDef) => ({ x: n.cx + HALF_W, y: n.cy });

// Connector paths run from one chip's right-edge midpoint to the next chip's
// left-edge midpoint. The splitter fork uses cubic Béziers so the two streams
// arc apart from a shared origin (the splitter's right-edge midpoint).
const PATHS = (() => {
  const a = rightMid(NODES.wallet);
  const b = leftMid(NODES.escrow);
  const c = rightMid(NODES.escrow);
  const d = leftMid(NODES.splitter);
  const fork = rightMid(NODES.splitter);
  const cr = leftMid(NODES.creator);
  const pl = leftMid(NODES.platform);

  // Horizontal control offset for the fork arcs — half the gap reads smooth.
  const k = (cr.x - fork.x) * 0.5;

  return {
    walletEscrow: `M ${a.x} ${a.y} L ${b.x} ${b.y}`,
    escrowSplitter: `M ${c.x} ${c.y} L ${d.x} ${d.y}`,
    splitterCreator: `M ${fork.x} ${fork.y} C ${fork.x + k} ${fork.y}, ${cr.x - k} ${cr.y}, ${cr.x} ${cr.y}`,
    splitterPlatform: `M ${fork.x} ${fork.y} C ${fork.x + k} ${fork.y}, ${pl.x - k} ${pl.y}, ${pl.x} ${pl.y}`,
  } as const;
})();

const TONE_HEX: Record<Tone, string> = {
  cyan: "#22D3EE",
  violet: "#8B5CF6",
  emerald: "#34D399",
};

export function FlowDiagram({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  // A single shared loop clock keeps every segment in phase. The payment hops
  // segment-by-segment, then the splitter forks into two streams. `tick` only
  // re-seeds the animation and drives the per-node arrival pulse.
  const [tick, setTick] = React.useState(0);

  // `reduce` is a client-only media query and is false during SSR. To keep the
  // server HTML and the first client render structurally identical (the SVG
  // tree must not gain/lose the animated layer between them), the reduced-motion
  // decision is deferred until after mount. Before mount we render exactly what
  // the server did: the animated layer present, no node pulsing yet.
  const mounted = useMounted();

  // Static once mounted under reduced motion; animated otherwise.
  const animate = mounted && !reduce;

  React.useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setTick((t) => t + 1), 3600);
    return () => clearInterval(id);
  }, [animate]);

  return (
    <div
      className={cn("relative w-full", className)}
      role="img"
      aria-label="资金流动示意：智能体钱包付款，进入预付托管，由合约原子分账，两成返给创作者、八成归平台"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="h-auto w-full overflow-visible"
        fill="none"
        aria-hidden
      >
        <defs>
          {/* Soft glow filter for the single active focal token. */}
          <filter id="flow-glow" x="-80%" y="-80%" width="260%" height="260%">
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
              <stop offset="100%" stopColor={TONE_HEX[tone]} stopOpacity="0.1" />
            </radialGradient>
          ))}
        </defs>

        {/* === Layer 1 — rails, behind everything ======================= */}
        <g stroke="rgba(255,255,255,0.10)" strokeWidth={1.25} strokeLinecap="round">
          <path d={PATHS.walletEscrow} />
          <path d={PATHS.escrowSplitter} />
        </g>
        {/* Tinted split streams: cyan = 20% to creator, violet = 80% platform. */}
        <path
          d={PATHS.splitterCreator}
          stroke="rgba(34,211,238,0.28)"
          strokeWidth={1.25}
          strokeLinecap="round"
        />
        <path
          d={PATHS.splitterPlatform}
          stroke="rgba(139,92,246,0.28)"
          strokeWidth={1.25}
          strokeLinecap="round"
        />

        {/* === Layer 2 — flowing rail wash + travelling tokens ===========
            Rendered on the server and the first client paint so hydration
            matches; only dropped once mounted under reduced motion. */}
        {!mounted || animate ? (
          <>
            <FlowingRails />
            <FlowTokens tick={tick} />
          </>
        ) : null}

        {/* === Layer 3 — node chips, in front of the rails ============== */}
        {(Object.keys(NODES) as NodeKey[]).map((key, i) => (
          <NodeChip
            key={key}
            node={NODES[key]}
            active={animate && tick % 5 === i}
          />
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Flowing rails — slow stroke-dashoffset crawl so the tracks read "live".   */
/* ------------------------------------------------------------------------ */

function FlowingRails() {
  return (
    <g fill="none" strokeLinecap="round">
      <FlowingRail d={PATHS.walletEscrow} tone="cyan" />
      <FlowingRail d={PATHS.escrowSplitter} tone="cyan" />
      <FlowingRail d={PATHS.splitterCreator} tone="cyan" />
      <FlowingRail d={PATHS.splitterPlatform} tone="violet" />
    </g>
  );
}

function FlowingRail({ d, tone }: { d: string; tone: Tone }) {
  return (
    <motion.path
      d={d}
      stroke={TONE_HEX[tone]}
      strokeOpacity={0.35}
      strokeWidth={1.25}
      strokeDasharray="3 14"
      initial={{ strokeDashoffset: 0 }}
      animate={{ strokeDashoffset: -34 }}
      transition={{ duration: 2.4, ease: "linear", repeat: Infinity }}
    />
  );
}

/* ------------------------------------------------------------------------ */
/* Travelling tokens — one per segment, sequenced over a 3.6s loop.          */
/* ------------------------------------------------------------------------ */

function FlowTokens({ tick }: { tick: number }) {
  // Keying on `tick` retriggers the staggered hop cleanly each loop: the
  // payment travels wallet → escrow → splitter, then forks into both streams.
  return (
    <g key={tick}>
      <Token path={PATHS.walletEscrow} tone="cyan" delay={0} glow />
      <Token path={PATHS.escrowSplitter} tone="cyan" delay={0.85} glow />
      <Token path={PATHS.splitterCreator} tone="cyan" delay={1.75} glow />
      <Token path={PATHS.splitterPlatform} tone="violet" delay={1.75} />
    </g>
  );
}

function Token({
  path,
  tone,
  delay,
  glow,
}: {
  path: string;
  tone: Tone;
  delay: number;
  glow?: boolean;
}) {
  // Travels along its connector via CSS offset-path (transform-only), fading in
  // at the start and out on arrival so the token appears to "land" at the node.
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
        opacity: {
          duration: 0.85,
          delay,
          times: [0, 0.16, 0.82, 1],
          ease: SPRING,
        },
      }}
      style={
        {
          offsetPath: `path('${path}')`,
          offsetRotate: "0deg",
        } as React.CSSProperties
      }
    >
      <circle
        r={5.5}
        fill={`url(#flow-token-${tone})`}
        filter={glow ? "url(#flow-glow)" : undefined}
      />
      <circle r={2.2} fill="#ffffff" fillOpacity={0.9} />
    </motion.g>
  );
}

/* ------------------------------------------------------------------------ */
/* Node chip — quiet dark-glass card living inside the SVG via foreignObject. */
/* Same coordinate system as the rails, so edges and endpoints always match.  */
/* ------------------------------------------------------------------------ */

const TONE_TEXT: Record<Tone, string> = {
  cyan: "text-cyan",
  violet: "text-violet",
  emerald: "text-emerald",
};
const TONE_RING: Record<Tone, string> = {
  cyan: "ring-cyan/40",
  violet: "ring-violet/40",
  emerald: "ring-emerald/40",
};
const TONE_GLOW: Record<Tone, string> = {
  cyan: "shadow-glow-cyan",
  violet: "shadow-glow-violet",
  emerald: "shadow-glow-emerald",
};

function NodeChip({ node, active }: { node: NodeDef; active: boolean }) {
  // Place the box by its top-left corner in viewBox units; the chip's edge
  // midpoints are exactly the connector endpoints by construction.
  const x = node.cx - NODE_W / 2;
  const y = node.cy - NODE_H / 2;

  return (
    <foreignObject
      x={x}
      y={y}
      width={NODE_W}
      height={NODE_H}
      style={{ overflow: "visible" }}
    >
      <motion.div
        className="flex h-full w-full items-center justify-center"
        animate={{ scale: active ? 1.05 : 1 }}
        transition={{ duration: 0.6, ease: SPRING }}
      >
        <div
          className={cn(
            // Resting chip is quiet: hairline ring + subtle inset highlight.
            // Glow is reserved for the active (arrival) node only.
            "h-full w-full rounded-[10px] bg-ink-raised/90 px-3 py-2 shadow-inset-hi ring-1 backdrop-blur-sm transition-shadow duration-700 ease-spring",
            active ? `${TONE_RING[node.tone]} ${TONE_GLOW[node.tone]}` : "ring-white/10",
          )}
        >
          <div
            className={cn(
              "font-mono text-[8px] uppercase leading-none tracking-[0.18em]",
              TONE_TEXT[node.tone],
            )}
          >
            {node.eyebrow}
          </div>
          <div className="mt-1 truncate text-[12px] font-medium leading-tight text-white">
            {node.title}
          </div>
          <div className="mt-0.5 truncate font-mono text-[9px] leading-tight text-white/45">
            {node.sub}
          </div>
        </div>
      </motion.div>
    </foreignObject>
  );
}

export default FlowDiagram;
