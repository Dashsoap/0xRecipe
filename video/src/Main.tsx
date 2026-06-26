import React from "react";
import { AbsoluteFill, Audio, staticFile } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { COLORS } from "./theme";
import { Background } from "./components/Background";
import { S1Title } from "./scenes/S1Title";
import { S2Problem } from "./scenes/S2Problem";
import { S3Prepay } from "./scenes/S3Prepay";
import { S4Voucher } from "./scenes/S4Voucher";
import { S5Split } from "./scenes/S5Split";
import { S6Fusion } from "./scenes/S6Fusion";
import { S7BudgetWall } from "./scenes/S7BudgetWall";
import { S8Outro } from "./scenes/S8Outro";

const TRANS = 16;

type Trans = "fade" | "slide";
const SCENES: { C: React.FC; d: number; trans?: Trans }[] = [
  { C: S1Title, d: 150 },
  { C: S2Problem, d: 280, trans: "fade" },
  { C: S3Prepay, d: 290, trans: "slide" },
  { C: S4Voucher, d: 275, trans: "slide" },
  { C: S5Split, d: 300, trans: "slide" },
  { C: S6Fusion, d: 300, trans: "slide" },
  { C: S7BudgetWall, d: 295, trans: "slide" },
  { C: S8Outro, d: 185, trans: "fade" },
];

const presentationFor = (t: Trans | undefined) =>
  t === "slide" ? slide({ direction: "from-right" }) : fade();

export const TOTAL_FRAMES =
  SCENES.reduce((a, s) => a + s.d, 0) - (SCENES.length - 1) * TRANS;

export const Main: React.FC = () => {
  const children: React.ReactNode[] = [];
  SCENES.forEach((s, i) => {
    if (i > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`t${i}`}
          presentation={presentationFor(s.trans)}
          timing={linearTiming({ durationInFrames: TRANS })}
        />,
      );
    }
    const C = s.C;
    children.push(
      <TransitionSeries.Sequence key={`s${i}`} durationInFrames={s.d}>
        <C />
      </TransitionSeries.Sequence>,
    );
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink0 }}>
      {/* Background music bed. volume is the one knob to tune; lower it (e.g. 0.4)
          once a voiceover track is layered on top. */}
      <Audio src={staticFile("bgm.mp3")} volume={0.7} />
      <Background />
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
};
