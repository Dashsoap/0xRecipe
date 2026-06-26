import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
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

const SCENES: { C: React.FC; d: number }[] = [
  { C: S1Title, d: 150 },
  { C: S2Problem, d: 280 },
  { C: S3Prepay, d: 290 },
  { C: S4Voucher, d: 275 },
  { C: S5Split, d: 300 },
  { C: S6Fusion, d: 300 },
  { C: S7BudgetWall, d: 295 },
  { C: S8Outro, d: 185 },
];

export const TOTAL_FRAMES =
  SCENES.reduce((a, s) => a + s.d, 0) - (SCENES.length - 1) * TRANS;

export const Main: React.FC = () => {
  const children: React.ReactNode[] = [];
  SCENES.forEach((s, i) => {
    if (i > 0) {
      children.push(
        <TransitionSeries.Transition
          key={`t${i}`}
          presentation={fade()}
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
      <Background />
      <TransitionSeries>{children}</TransitionSeries>
    </AbsoluteFill>
  );
};
