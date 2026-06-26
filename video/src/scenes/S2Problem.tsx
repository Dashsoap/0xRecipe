import { AbsoluteFill } from "remotion";
import { COLORS, SAFE, TYPE } from "../theme";
import { Headline, Sub, Reveal, Highlight } from "../components/ui";
import { Banned, IconUser, IconCard, IconKey } from "../components/icons";

const Blocker: React.FC<{ at: number; label: string; icon: React.ReactNode }> = ({ at, label, icon }) => (
  <Reveal at={at} y={36} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: 360 }}>
    <Banned size={150}>{icon}</Banned>
    <Sub size={TYPE.label} style={{ color: COLORS.white, textAlign: "center", fontWeight: 600 }}>{label}</Sub>
  </Reveal>
);

export const S2Problem: React.FC = () => {
  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 96, textAlign: "center" }}>
        <Reveal at={4} y={48}>
          <Headline size={TYPE.headline}>
            Agents can act alone.
            <br />
            But how do they <Highlight>pay</Highlight>?
          </Headline>
        </Reveal>
        <div style={{ display: "flex", gap: 120, justifyContent: "center" }}>
          <Blocker at={40} label="No human in the loop" icon={<IconUser size={92} color={COLORS.lavender} />} />
          <Blocker at={58} label="No credit cards" icon={<IconCard size={92} color={COLORS.lavender} />} />
          <Blocker at={76} label="No shared API keys" icon={<IconKey size={92} color={COLORS.lavender} />} />
        </div>
      </div>
    </AbsoluteFill>
  );
};
