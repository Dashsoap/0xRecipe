import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS, SAFE, TYPE, FONT, MONO } from "../theme";
import { Eyebrow, Headline, Reveal, Highlight, GlassCard, Sub } from "../components/ui";
import { IconScale, IconDoc } from "../components/icons";

const ModelChip: React.FC<{ at: number; tint: string; name: string }> = ({ at, tint, name }) => (
  <Reveal at={at} y={22}>
    <GlassCard style={{ width: 300, height: 96, display: "flex", alignItems: "center", gap: 20, padding: "0 28px", border: `1px solid ${tint}66` }}>
      <div style={{ width: 18, height: 18, borderRadius: "50%", background: tint, boxShadow: `0 0 18px ${tint}` }} />
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: TYPE.small, color: COLORS.white }}>{name}</div>
    </GlassCard>
  </Reveal>
);

export const S6Fusion: React.FC = () => {
  const frame = useCurrentFrame();
  const found = Math.min(6, Math.max(0, Math.floor(interpolate(frame, [104, 150], [0, 6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))));
  const flags = ["Rent amount", "Late fee", "Deposit window", "Notice period", "Pets clause", "Subletting"];

  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 64, textAlign: "center" }}>
        <Reveal at={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
            <Eyebrow>The product — Fusion</Eyebrow>
            <Headline size={TYPE.title}>
              Don’t ask one model. Ask a <Highlight>panel</Highlight>.
            </Headline>
          </div>
        </Reveal>

        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          {/* panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <ModelChip at={20} tint={COLORS.violetBright} name="Model A" />
            <ModelChip at={30} tint={COLORS.cyan} name="Model B" />
            <ModelChip at={40} tint={COLORS.emerald} name="Model C" />
          </div>

          <Reveal at={52} y={0}><div style={{ fontFamily: FONT, fontSize: 56, color: COLORS.textFaint }}>→</div></Reveal>

          {/* judge */}
          <Reveal at={58} scaleFrom={0.8}>
            <GlassCard glow={`${COLORS.violet}66`} style={{ width: 240, height: 240, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <IconScale size={104} color={COLORS.lavender} />
              <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: TYPE.small, color: COLORS.white }}>Judge</div>
            </GlassCard>
          </Reveal>

          <Reveal at={78} y={0}><div style={{ fontFamily: FONT, fontSize: 56, color: COLORS.textFaint }}>→</div></Reveal>

          {/* result */}
          <Reveal at={84}>
            <GlassCard glow={`${COLORS.cyan}44`} style={{ width: 420, height: 360, padding: 30, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <IconDoc size={40} color={COLORS.cyan} />
                <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: TYPE.small, color: COLORS.white }}>Contradictions</div>
                <div style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 40, fontWeight: 800, color: COLORS.emerald }}>{found}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
                {flags.map((f, i) => {
                  const on = i < found;
                  return (
                    <div key={f} style={{ display: "flex", alignItems: "center", gap: 12, opacity: on ? 1 : 0.18, transition: "none" }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: on ? COLORS.emerald : COLORS.textFaint }} />
                      <div style={{ fontFamily: MONO, fontSize: 26, color: on ? COLORS.white : COLORS.textFaint }}>{f}</div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </Reveal>
        </div>

        <Reveal at={92}>
          <Sub size={TYPE.body} style={{ maxWidth: 1340 }}>
            A judge reconciles the panel — catching conflicts a single model misses.
          </Sub>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
