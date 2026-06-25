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

  const MotionTag = motion[as];

  if (reduce) {
    const Tag = as;
    return (
      <Tag className={className} style={style} id={id}>
        {children}
      </Tag>
    );
  }

  const shown = inView || settled;

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      style={style}
      id={id}
      initial={{ opacity: 0, y, filter: "blur(8px)" }}
      animate={
        shown
          ? { opacity: 1, y: 0, filter: "blur(0px)" }
          : { opacity: 0, y, filter: "blur(8px)" }
      }
      transition={{ duration: 0.7, delay, ease: SPRING }}
    >
      {children}
    </MotionTag>
  );
}
