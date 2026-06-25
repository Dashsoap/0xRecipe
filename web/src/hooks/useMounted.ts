"use client";

import * as React from "react";

/**
 * False on the server and on the first client render, then true after mount.
 *
 * Use to defer client-only decisions (e.g. `useReducedMotion()`) so the SSR
 * HTML and the first client render are identical — otherwise React throws a
 * hydration mismatch. Extracted from the repeated mounted-gate pattern in
 * Reveal / FlowDiagram / CreatorPane.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}
