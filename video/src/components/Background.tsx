import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "../theme";

/** A large flowing rounded gradient form (the signature shape of the deck). */
const FlowShape: React.FC<{
  from: string;
  to: string;
  size: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  rot: number;
  rotAmt: number;
  phase: number;
  opacity?: number;
  blur?: number;
}> = ({ from, to, size, x0, y0, dx, dy, rot, rotAmt, phase, opacity = 0.4, blur = 60 }) => {
  const frame = useCurrentFrame();
  // Slow, organic back-and-forth drift + gentle rotation over a long loop.
  const t = interpolate((frame + phase) % 900, [0, 450, 900], [0, 1, 0], {
    easing: Easing.inOut(Easing.ease),
  });
  const r = interpolate((frame + phase) % 900, [0, 450, 900], [-1, 1, -1], {
    easing: Easing.inOut(Easing.ease),
  });
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size * 0.82,
        left: x0 + dx * t,
        top: y0 + dy * t,
        borderRadius: "44% 56% 52% 48% / 50% 46% 54% 50%",
        background: `linear-gradient(125deg, ${from}, ${to})`,
        rotate: `${rot + r * rotAmt}deg`,
        filter: `blur(${blur}px)`,
        opacity,
      }}
    />
  );
};

/** Persistent animated backdrop: deep indigo ground + flowing violet shapes. */
export const Background: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(135% 120% at 16% 6%, ${COLORS.ink2} 0%, ${COLORS.ink1} 44%, ${COLORS.ink0} 100%)`,
      }}
    >
      {/* signature flowing rounded forms */}
      <FlowShape from={COLORS.violet} to="#3b1d8f" size={1280} x0={-360} y0={-340} dx={150} dy={90} rot={-18} rotAmt={6} phase={0} opacity={0.5} blur={55} />
      <FlowShape from={COLORS.violetBright} to={COLORS.cyan} size={980} x0={1180} y0={-220} dx={-130} dy={130} rot={28} rotAmt={7} phase={300} opacity={0.36} blur={60} />
      <FlowShape from="#4c1d95" to={COLORS.violet} size={1120} x0={520} y0={560} dx={90} dy={-70} rot={12} rotAmt={5} phase={560} opacity={0.42} blur={70} />

      {/* soft cool glow for depth */}
      <div
        style={{
          position: "absolute",
          width: 760,
          height: 760,
          left: 1240,
          top: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 50%, ${COLORS.cyan} 0%, transparent 66%)`,
          filter: "blur(100px)",
          opacity: 0.18,
        }}
      />

      {/* fine grain */}
      <AbsoluteFill style={{ opacity: 0.05, mixBlendMode: "overlay" }}>
        <svg width="100%" height="100%">
          <filter id="bg-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#bg-grain)" />
        </svg>
      </AbsoluteFill>

      {/* vignette for text contrast */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(125% 95% at 50% 45%, transparent 52%, rgba(0,0,0,0.5) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
