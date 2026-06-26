import { AbsoluteFill } from "remotion";
import { COLORS, SAFE, TYPE } from "../theme";
import { Eyebrow, Headline, Sub, Reveal, GradientText, Pill } from "../components/ui";
import { IconLink } from "../components/icons";

export const S1Title: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        padding: SAFE,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <Reveal at={4}>
          <Eyebrow>Autonomous · Pay-per-call AI</Eyebrow>
        </Reveal>
        <Reveal at={14} y={56}>
          <Headline size={TYPE.display} style={{ textShadow: `0 0 80px ${COLORS.violet}66` }}>
            <GradientText from={COLORS.violetBright} to={COLORS.cyan}>0x</GradientText>
            Recipe
          </Headline>
        </Reveal>
        <Reveal at={34}>
          <Sub size={TYPE.body} style={{ color: COLORS.lavender, maxWidth: 1200 }}>
            The marketplace where AI agents pay for AI — by the call.
          </Sub>
        </Reveal>
        <Reveal at={52} y={28}>
          <Pill color={COLORS.cyan} style={{ marginTop: 14 }}>
            <IconLink size={30} color={COLORS.cyan} /> On Injective EVM
          </Pill>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
