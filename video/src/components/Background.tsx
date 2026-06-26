import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "../theme";

/** A single soft gradient blob that drifts slowly across the frame. */
const Blob: React.FC<{
  color: string;
  size: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  phase: number;
  opacity?: number;
}> = ({ color, size, x0, y0, dx, dy, phase, opacity = 0.55 }) => {
  const frame = useCurrentFrame();
  // Slow, continuous ease-in-out drift (cosine via bezier ping-pong over 600f).
  const t = interpolate((frame + phase) % 600, [0, 300, 600], [0, 1, 0], {
    easing: Easing.inOut(Easing.ease),
  });
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        left: x0 + dx * t,
        top: y0 + dy * t,
        borderRadius: "50%",
        background: `radial-gradient(circle at 50% 50%, ${color} 0%, transparent 68%)`,
        filter: "blur(90px)",
        opacity,
      }}
    />
  );
};

/** Persistent animated backdrop: deep indigo ground + drifting violet shapes. */
export const Background: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(130% 120% at 18% 8%, ${COLORS.ink2} 0%, ${COLORS.ink1} 42%, ${COLORS.ink0} 100%)`,
      }}
    >
      <Blob color={COLORS.violet} size={1100} x0={-180} y0={-260} dx={140} dy={90} phase={0} opacity={0.5} />
      <Blob color={COLORS.violetBright} size={900} x0={1150} y0={-160} dx={-120} dy={120} phase={150} opacity={0.42} />
      <Blob color={COLORS.cyan} size={760} x0={1300} y0={620} dx={-90} dy={-70} phase={320} opacity={0.22} />
      <Blob color="#4c1d95" size={1000} x0={420} y0={560} dx={80} dy={-60} phase={460} opacity={0.5} />

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
            "radial-gradient(120% 90% at 50% 45%, transparent 55%, rgba(0,0,0,0.45) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
