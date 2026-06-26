import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, SAFE, TYPE, FONT, MONO } from "../theme";
import { Eyebrow, Headline, Reveal, Highlight, GlassCard, Coin, Sub } from "../components/ui";
import { IconLink } from "../components/icons";

const ShareCard: React.FC<{ at: number; pct: string; label: string; color: string; x: number }> = ({ at, pct, label, color, x }) => (
  <div style={{ position: "absolute", left: x, top: 360 }}>
    <Reveal at={at} y={28}>
      <GlassCard glow={`${color}55`} style={{ width: 420, height: 230, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, border: `1px solid ${color}66` }}>
        <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 96, color, lineHeight: 1 }}>{pct}</div>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: TYPE.small, color: COLORS.white }}>{label}</div>
      </GlassCard>
    </Reveal>
  </div>
);

const Stream: React.FC<{ x1: number; x2: number; color: string; startFrame: number }> = ({ x1, x2, color, startFrame }) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame, [startFrame, startFrame + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const op = interpolate(frame, [startFrame, startFrame + 6, startFrame + 22, startFrame + 30], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const x = x1 + (x2 - x1) * t;
  const y = 150 + 190 * t;
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: op }}>
      <Coin size={56} color={color} />
    </div>
  );
};

export const S5Split: React.FC = () => {
  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 56, textAlign: "center" }}>
        <Reveal at={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
            <Eyebrow>Atomic settlement</Eyebrow>
            <Headline size={TYPE.title}>
              Every charge splits <Highlight from={COLORS.emerald} to={COLORS.cyan}>on-chain</Highlight>.
            </Headline>
          </div>
        </Reveal>

        <div style={{ position: "relative", width: 1500, height: 600 }}>
          {/* connectors */}
          <svg width="1500" height="600" style={{ position: "absolute", inset: 0 }}>
            <path d="M750 150 L320 360" stroke={`${COLORS.emerald}66`} strokeWidth="3" fill="none" />
            <path d="M750 150 L1180 360" stroke={`${COLORS.violet}66`} strokeWidth="3" fill="none" />
          </svg>

          {/* top: the gross charge */}
          <div style={{ position: "absolute", left: 660, top: 30 }}>
            <Reveal at={16}>
              <GlassCard glow={`${COLORS.cyan}44`} style={{ width: 180, height: 180, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Coin size={84} color={COLORS.cyan} />
                <div style={{ fontFamily: MONO, fontSize: 24, color: COLORS.textDim }}>1 charge</div>
              </GlassCard>
            </Reveal>
          </div>

          <Stream x1={740} x2={300} color={COLORS.emerald} startFrame={40} />
          <Stream x1={740} x2={1160} color={COLORS.violet} startFrame={40} />

          <ShareCard at={56} pct="20%" label="Recipe creator" color={COLORS.emerald} x={120} />
          <ShareCard at={64} pct="80%" label="Platform" color={COLORS.violetBright} x={960} />
        </div>

        <Reveal at={92}>
          <Sub size={TYPE.body} style={{ maxWidth: 1320, display: "inline-flex", gap: 16, alignItems: "center", justifyContent: "center" }}>
            <IconLink size={40} color={COLORS.cyan} /> One atomic transaction — creators earn 20% on every call.
          </Sub>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
