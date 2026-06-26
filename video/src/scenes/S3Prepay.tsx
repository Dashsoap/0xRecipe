import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS, SAFE, TYPE, FONT, MONO } from "../theme";
import { Eyebrow, Headline, Sub, Reveal, Highlight, GlassCard, Coin } from "../components/ui";
import { IconWallet, IconLock } from "../components/icons";

const Node: React.FC<{ children: React.ReactNode; label: string; w?: number; glow?: string }> = ({
  children, label, w = 360, glow,
}) => (
  <GlassCard glow={glow} style={{ width: w, height: 280, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22 }}>
    {children}
    <div style={{ fontFamily: FONT, fontSize: TYPE.label, fontWeight: 700, color: COLORS.white }}>{label}</div>
  </GlassCard>
);

export const S3Prepay: React.FC = () => {
  const frame = useCurrentFrame();
  // a coin travels wallet -> vault
  const travel = interpolate(frame, [40, 92], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const coinX = 360 + travel * 740;
  const coinOpacity = interpolate(frame, [38, 46, 86, 96], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // vault balance ticks up after the coin lands
  const bal = Math.round(interpolate(frame, [92, 120], [0, 50], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ padding: SAFE, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 70, textAlign: "center" }}>
        <Reveal at={2}>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, alignItems: "center" }}>
            <Eyebrow>Step 1 — Prepay</Eyebrow>
            <Headline size={TYPE.title}>
              One <Highlight>deposit</Highlight>, locked on-chain.
            </Headline>
          </div>
        </Reveal>

        <div style={{ position: "relative", width: 1500, height: 300, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Reveal at={18}>
            <Node label="Agent wallet" w={420}>
              <IconWallet size={104} color={COLORS.lavender} />
            </Node>
          </Reveal>
          <Reveal at={30}>
            <Node label="On-chain escrow" w={460} glow={`${COLORS.violet}55`}>
              <IconLock size={104} color={COLORS.cyan} />
              <div style={{ fontFamily: MONO, fontSize: 30, color: COLORS.emerald, marginTop: -6 }}>
                {bal.toFixed(2)} USDC
              </div>
            </Node>
          </Reveal>
          <div style={{ position: "absolute", left: coinX, top: 104, opacity: coinOpacity }}>
            <Coin size={84} />
          </div>
        </div>

        <Reveal at={108}>
          <Sub size={TYPE.body} style={{ maxWidth: 1300 }}>
            Fund a wallet once — no accounts, no cards. The balance is held in escrow until spent.
          </Sub>
        </Reveal>
      </div>
    </AbsoluteFill>
  );
};
