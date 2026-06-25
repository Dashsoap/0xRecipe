"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

// Signature spring curve, shared with the Tailwind `ease-spring` token.
const SPRING = [0.32, 0.72, 0, 1] as const;

export interface RevealProps {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  id?: string;
  /** Stagger this item by N seconds after it enters the viewport. */
  delay?: number;
  /** Travel distance in px for the fade-up. */
  y?: number;
  /** Animate every time it enters the viewport, not just once. */
  repeat?: boolean;
  /** Wrap in a different element for semantics (e.g. "section"). */
  as?: "div" | "section" | "li" | "span";
}

/**
 * Scroll-in wrapper: fade-up + blur-resolve on `whileInView`, using the
 * project's spring curve. Honours prefers-reduced-motion (renders static).
 * Wrap any block to give it the signature entrance.
 */
export function Reveal({
  children,
  className,
  style,
  id,
  delay = 0,
  y = 24,
  repeat = false,
  as = "div",
}: RevealProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, {
    once: !repeat,
    amount: 0.3,
    margin: "0px 0px -10% 0px",
  });

  // Safety net: if the observer never reports the block in view (deep-link to a
  // lower section, a tab restored mid-page, headless capture), reveal it anyway
  // after a beat so content can never get stuck at opacity 0.
  const [settled, setSettled] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setSettled(true), 1200);
    return () => window.clearTimeout(t);
  }, []);

  // Defer the reduced-motion decision until after mount so the first client
  // render matches the server (which always sees reduce=false).
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const reducedNow = mounted && reduce;

  const MotionTag = motion[as];

  // The element type and `initial` never depend on `reduce`, so the SSR HTML and
  // the first client render are identical (no hydration mismatch). Only the
  // post-mount animation target reacts to reduced motion: when reduced, jump
  // straight to the shown state with a zero-length transition.
  const shown = reducedNow || inView || settled;
  const VISIBLE = { opacity: 1, y: 0, filter: "blur(0px)" } as const;
  const HIDDEN = { opacity: 0, y, filter: "blur(8px)" } as const;

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      style={style}
      id={id}
      initial={HIDDEN}
      animate={shown ? VISIBLE : HIDDEN}
      transition={
        reducedNow ? { duration: 0 } : { duration: 0.7, delay, ease: SPRING }
      }
    >
      {children}
    </MotionTag>
  );
}
