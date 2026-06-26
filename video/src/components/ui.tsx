import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, FONT, MONO, TYPE } from "../theme";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const BACK = Easing.bezier(0.34, 1.4, 0.5, 1); // gentle overshoot for "pop" entrances

/** Fade + rise into a reserved layout slot, starting at frame `at`. */
export const Reveal: React.FC<{
  at?: number;
  dur?: number;
  y?: number;
  scaleFrom?: number;
  pop?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at = 0, dur = 16, y = 44, scaleFrom = 1, pop = false, children, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  // opacity rises fast; scale uses an overshoot curve when `pop` is set.
  const op = interpolate(frame, [at, at + dur * 0.6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const s = interpolate(frame, [at, at + dur], [scaleFrom, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: pop ? BACK : EASE,
  });
  return (
    <div
      style={{
        opacity: op,
        translate: `0px ${(1 - p) * y}px`,
        scale: s,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Headline mask-reveal: text slides up from behind a clipping edge. */
export const MaskUp: React.FC<{
  at?: number;
  dur?: number;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ at = 0, dur = 24, children, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  const op = interpolate(frame, [at, at + dur * 0.4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.14em", ...style }}>
      <div style={{ translate: `0px ${(1 - p) * 112}%`, opacity: op }}>{children}</div>
    </div>
  );
};

/** An SVG path that draws itself on between frames `at` and `at+dur`.
 * Must be rendered inside an <svg>. */
export const DrawLine: React.FC<{
  d: string;
  at?: number;
  dur?: number;
  stroke: string;
  sw?: number;
}> = ({ d, at = 0, dur = 24, stroke, sw = 3 }) => {
  const frame = useCurrentFrame();
  const offset = interpolate(frame, [at, at + dur], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: EASE,
  });
  return (
    <path
      d={d}
      stroke={stroke}
      strokeWidth={sw}
      fill="none"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={offset}
    />
  );
};

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = COLORS.lavender,
}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: TYPE.eyebrow,
      fontWeight: 700,
      letterSpacing: "0.42em",
      textTransform: "uppercase",
      color,
    }}
  >
    {children}
  </div>
);

export const Headline: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = TYPE.headline, style }) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1.02,
      color: COLORS.white,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A keyword in a filled gradient pill — the "highlighter" accent of the deck. */
export const Highlight: React.FC<{ children: React.ReactNode; from?: string; to?: string }> = ({
  children,
  from = COLORS.violet,
  to = COLORS.cyan,
}) => (
  <span
    style={{
      display: "inline-block",
      background: `linear-gradient(100deg, ${from}, ${to})`,
      color: COLORS.ink0,
      padding: "0.02em 0.28em",
      borderRadius: 18,
      marginRight: "0.04em",
      boxDecorationBreak: "clone",
    }}
  >
    {children}
  </span>
);

/** Gradient text (no box) — for emphasis inside a headline. */
export const GradientText: React.FC<{ children: React.ReactNode; from?: string; to?: string }> = ({
  children,
  from = COLORS.violetBright,
  to = COLORS.cyan,
}) => (
  <span
    style={{
      background: `linear-gradient(100deg, ${from}, ${to})`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      color: "transparent",
    }}
  >
    {children}
  </span>
);

export const Sub: React.FC<{
  children: React.ReactNode;
  size?: number;
  style?: React.CSSProperties;
}> = ({ children, size = TYPE.body, style }) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      fontWeight: 500,
      lineHeight: 1.3,
      color: COLORS.textDim,
      ...style,
    }}
  >
    {children}
  </div>
);

export const GlassCard: React.FC<{
  children?: React.ReactNode;
  style?: React.CSSProperties;
  glow?: string;
}> = ({ children, style, glow }) => (
  <div
    style={{
      background: COLORS.glassBg,
      border: `1px solid ${COLORS.glassRing}`,
      borderRadius: 32,
      backdropFilter: "blur(20px)",
      boxShadow: glow
        ? `0 30px 80px -30px ${glow}, inset 0 1px 0 rgba(255,255,255,0.08)`
        : "inset 0 1px 0 rgba(255,255,255,0.08)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const Pill: React.FC<{
  children: React.ReactNode;
  color?: string;
  style?: React.CSSProperties;
}> = ({ children, color = COLORS.violetBright, style }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      fontFamily: MONO,
      fontSize: TYPE.small,
      fontWeight: 600,
      color: COLORS.white,
      padding: "14px 26px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${color}55`,
      ...style,
    }}
  >
    {children}
  </div>
);

/** A coin token (USDC) — used in the funds-flow scenes. */
export const Coin: React.FC<{ size?: number; label?: string; color?: string }> = ({
  size = 92,
  label = "$",
  color = COLORS.emerald,
}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: FONT,
      fontWeight: 800,
      fontSize: size * 0.46,
      color: COLORS.ink0,
      background: `radial-gradient(circle at 38% 32%, ${COLORS.white} 0%, ${color} 46%, ${color} 100%)`,
      boxShadow: `0 0 36px ${color}77, inset 0 -6px 12px rgba(0,0,0,0.25)`,
    }}
  >
    {label}
  </div>
);
