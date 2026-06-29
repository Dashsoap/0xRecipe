import { AbsoluteFill } from "remotion";
import { COLORS, SAFE, TYPE } from "../theme";
import { Headline, Sub, Reveal, GradientText, Pill, Eyebrow } from "../components/ui";
import { IconLink } from "../components/icons";

export const S8Outro: React.FC = () => {
  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <Reveal at={4}>
          <Eyebrow>Prepay once · pay per call · creators earn</Eyebrow>
        </Reveal>
        <Reveal at={12} y={28} scaleFrom={0.88} pop>
          <Headline size={TYPE.display} style={{ textShadow: `0 0 80px ${COLORS.violet}66` }}>
            <GradientText from={COLORS.violetBright} to={COLORS.cyan}>0x</GradientText>
            Recipe
          </Headline>
        </Reveal>
        <Reveal at={32}>
          <Sub size={TYPE.body} style={{ color: COLORS.lavender }}>
            Autonomous, pay-per-call AI.
          </Sub>
        </Reveal>
        <Reveal at={48} y={28}>
          <Pill color={COLORS.cyan} style={{ marginTop: 14 }}>
            <IconLink size={30} color={COLORS.cyan} /> Built on Injective EVM
          </Pill>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
