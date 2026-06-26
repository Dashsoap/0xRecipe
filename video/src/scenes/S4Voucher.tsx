import { AbsoluteFill } from "remotion";
import { COLORS, SAFE, TYPE, FONT } from "../theme";
import { Eyebrow, Headline, Sub, Reveal, Highlight, GlassCard, MaskUp } from "../components/ui";
import { IconAgent, IconSignature, IconCheck, IconBolt } from "../components/icons";

const Step: React.FC<{ at: number; icon: React.ReactNode; label: string; tint: string }> = ({ at, icon, label, tint }) => (
  <Reveal at={at} y={30}>
    <GlassCard glow={`${tint}40`} style={{ width: 300, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
      {icon}
      <div style={{ fontFamily: FONT, fontSize: TYPE.small, fontWeight: 700, color: COLORS.white, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
    </GlassCard>
  </Reveal>
);

const Arrow: React.FC<{ at: number }> = ({ at }) => (
  <Reveal at={at} y={0}>
    <div style={{ fontFamily: FONT, fontSize: 64, color: COLORS.textFaint, fontWeight: 300 }}>→</div>
  </Reveal>
);

export const S4Voucher: React.FC = () => {
  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 76, textAlign: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
          <Reveal at={2}><Eyebrow>Step 2 — Every call</Eyebrow></Reveal>
          <MaskUp at={8} dur={22}>
            <Headline size={TYPE.title}>
              Each call carries a <Highlight>signed voucher</Highlight>.
            </Headline>
          </MaskUp>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 36 }}>
          <Step at={22} tint={COLORS.lavender} icon={<IconAgent size={96} color={COLORS.lavender} />} label="Agent requests" />
          <Arrow at={34} />
          <Step at={40} tint={COLORS.violet} icon={<IconSignature size={96} color={COLORS.violetBright} />} label="Signs a voucher" />
          <Arrow at={52} />
          <Step at={58} tint={COLORS.cyan} icon={<IconCheck size={96} color={COLORS.cyan} />} label="Balance verified" />
          <Arrow at={70} />
          <Step at={76} tint={COLORS.emerald} icon={<IconBolt size={96} color={COLORS.emerald} />} label="Call runs" />
        </div>

        <Reveal at={96}>
          <Sub size={TYPE.body} style={{ maxWidth: 1320 }}>
            You pay only for calls that succeed — the platform never fronts unrecoverable cost.
          </Sub>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
