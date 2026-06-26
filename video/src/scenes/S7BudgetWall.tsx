import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, SAFE, TYPE, FONT, MONO } from "../theme";
import { Eyebrow, Headline, Reveal, Highlight, GlassCard, Sub, MaskUp } from "../components/ui";
import { IconAgent } from "../components/icons";

export const S7BudgetWall: React.FC = () => {
  const frame = useCurrentFrame();
  // balance bar drains from 100% to 0% between f30 and f78
  const fill = interpolate(frame, [30, 78], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const balUsd = (fill * 2).toFixed(2);
  const wallHit = frame >= 80;
  const chipP = interpolate(frame, [82, 96], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 64, textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
          <Reveal at={2}><Eyebrow>Safe by design</Eyebrow></Reveal>
          <MaskUp at={8} dur={22}>
            <Headline size={TYPE.title}>
              Out of budget? The agent <Highlight from={COLORS.violet} to={COLORS.cyan}>knows</Highlight>.
            </Headline>
          </MaskUp>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
          {/* balance meter */}
          <Reveal at={18}>
            <GlassCard style={{ width: 720, height: 250, padding: 40, display: "flex", flexDirection: "column", justifyContent: "center", gap: 26 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: TYPE.small, color: COLORS.white }}>Prepaid balance</div>
                <div style={{ fontFamily: MONO, fontSize: 44, fontWeight: 800, color: wallHit ? COLORS.violetBright : COLORS.emerald }}>{balUsd} USDC</div>
              </div>
              <div style={{ height: 30, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div style={{ width: `${fill * 100}%`, height: "100%", borderRadius: 999, background: `linear-gradient(90deg, ${COLORS.emerald}, ${COLORS.cyan})` }} />
              </div>
              <div style={{ minHeight: 56 }}>
                <div style={{ opacity: chipP, scale: `${0.84 + chipP * 0.16}`, display: "inline-flex", alignItems: "center", gap: 14, padding: "12px 22px", borderRadius: 14, background: `${COLORS.violet}22`, border: `1px solid ${COLORS.violetBright}66` }}>
                  <div style={{ fontFamily: MONO, fontWeight: 700, fontSize: 28, color: COLORS.violetBright }}>403 · insufficient balance</div>
                </div>
              </div>
            </GlassCard>
          </Reveal>

          {/* agent reasons */}
          <Reveal at={88}>
            <GlassCard glow={`${COLORS.violet}44`} style={{ width: 470, height: 250, padding: 34, display: "flex", flexDirection: "column", gap: 18, justifyContent: "center" }}>
              <IconAgent size={64} color={COLORS.lavender} />
              <div style={{ fontFamily: FONT, fontSize: 30, color: COLORS.white, lineHeight: 1.32, textAlign: "left" }}>
                “Budget exhausted — this isn’t a retry. I’ll stop and top up.”
              </div>
            </GlassCard>
          </Reveal>
        </div>

        <Reveal at={110}>
          <Sub size={TYPE.body} style={{ maxWidth: 1340 }}>
            It reasons about the limit and stops on its own — never overspends.
          </Sub>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
