"use client";

import * as React from "react";

import { balanceUrl } from "@/lib/api";

export type BalanceStatus = "idle" | "loading" | "ready" | "error";

export interface AgentBalance {
  /** Escrow balance in USDC base units (6 decimals), or null when unknown. */
  balanceUnits: string | null;
  status: BalanceStatus;
}

/**
 * Read an agent's prepaid escrow balance from the backend.
 *
 * SSR-safe (fetch runs in an effect only). Re-reads whenever `refreshKey`
 * changes — the caller bumps it on each settlement so the balance tracks the
 * live feed. When `agent` is null (no address configured) it stays idle and
 * never invents a number; a failed read surfaces as `status: "error"` with the
 * last known balance left untouched.
 */
export function useAgentBalance(
  agent: string | null,
  refreshKey: number,
): AgentBalance {
  const [balanceUnits, setBalanceUnits] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<BalanceStatus>("idle");

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!agent) {
      setStatus("idle");
      return;
    }

    let cancelled = false;
    // Keep showing the prior figure (if any) while a refresh is in flight.
    setStatus((prev) => (prev === "ready" ? "ready" : "loading"));

    fetch(balanceUrl(agent))
      .then(async (res) => {
        if (!res.ok) throw new Error(`balance ${res.status}`);
        return (await res.json()) as { balanceUnits?: unknown };
      })
      .then((data) => {
        if (cancelled) return;
        if (typeof data.balanceUnits === "string") {
          setBalanceUnits(data.balanceUnits);
          setStatus("ready");
        } else {
          setStatus("error");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [agent, refreshKey]);

  return { balanceUnits, status };
}
