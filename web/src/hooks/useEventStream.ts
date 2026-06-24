"use client";

import * as React from "react";
import type { FusionResult, SettlementEvent } from "@0xrecipe/shared";

/**
 * One row in the Agent view's recent-calls list. Mirrors what a single
 * charged call will surface: which recipe, how much was charged, and the
 * settlement tx it produced.
 */
export interface CallRecord {
  id: string;
  /** Display label of the recipe that was called. */
  recipe: string;
  /** Charged amount, in USDC base units (6 decimals), as a string. */
  amount: string;
  txHash: `0x${string}`;
  /** Unix epoch milliseconds. */
  timestamp: number;
  status: "settled" | "rejected";
}

export interface EventStreamState {
  /** Agent view: wallet, escrow balance and per-recipe budget. */
  agent: {
    address: `0x${string}`;
    /** Remaining escrow balance, USDC base units (6 decimals). */
    balance: string;
    /** Budget ceiling for the demo run, USDC base units. */
    budgetTotal: string;
    /** Amount spent so far, USDC base units. */
    budgetSpent: string;
    recentCalls: CallRecord[];
  };
  /** Creator view: wallet, cumulative payout and the latest split. */
  creator: {
    address: `0x${string}`;
    /** Cumulative earnings, USDC base units (6 decimals). */
    totalEarned: string;
    /** Most recent payout share, USDC base units. */
    latestPayout: string;
  };
  /** Newest settlement first. Drives the on-chain activity feed. */
  settlements: SettlementEvent[];
  /** Latest structured synthesis surfaced by a call, if any. */
  latestResult: FusionResult | null;
  /** True once a real stream is connected. Always false for demo data. */
  connected: boolean;
  /** Marks the data as placeholder so the UI can label it clearly. */
  isDemo: boolean;
}

// --- Demo data ----------------------------------------------------------
// Obvious placeholders only: zero / 0xDEMO-style addresses, amounts the UI
// labels as demo. No real wallets, recipes, prices or business entities.
// Replaced wholesale once the SSE wiring below is switched on.

const DEMO_AGENT_ADDR =
  "0x0000000000000000000000000000000000DE110A" as `0x${string}`;
const DEMO_CREATOR_ADDR =
  "0x0000000000000000000000000000000000DE110C" as `0x${string}`;
const DEMO_TX_A =
  "0x0000000000000000000000000000000000000000000000000000000000DEM0A1" as `0x${string}`;
const DEMO_TX_B =
  "0x0000000000000000000000000000000000000000000000000000000000DEM0B2" as `0x${string}`;

const DEMO_RECIPE_LABEL = "示例配方";

function buildDemoState(): EventStreamState {
  const now = Date.now();

  const settlements: SettlementEvent[] = [
    {
      type: "settlement",
      agent: DEMO_AGENT_ADDR,
      creator: DEMO_CREATOR_ADDR,
      amount: "50000", // demo, 6-decimal USDC base units
      txHash: DEMO_TX_B,
      recipeId: "legal-reviewer-v1",
      ts: now - 12_000,
    },
    {
      type: "settlement",
      agent: DEMO_AGENT_ADDR,
      creator: DEMO_CREATOR_ADDR,
      amount: "50000", // demo
      txHash: DEMO_TX_A,
      recipeId: "legal-reviewer-v1",
      ts: now - 48_000,
    },
  ];

  const recentCalls: CallRecord[] = [
    {
      id: "demo-2",
      recipe: DEMO_RECIPE_LABEL,
      amount: "50000",
      txHash: DEMO_TX_B,
      timestamp: now - 12_000,
      status: "settled",
    },
    {
      id: "demo-1",
      recipe: DEMO_RECIPE_LABEL,
      amount: "50000",
      txHash: DEMO_TX_A,
      timestamp: now - 48_000,
      status: "settled",
    },
  ];

  return {
    agent: {
      address: DEMO_AGENT_ADDR,
      balance: "100000", // demo escrow remaining
      budgetTotal: "200000", // demo budget ceiling
      budgetSpent: "100000", // demo spent
      recentCalls,
    },
    creator: {
      address: DEMO_CREATOR_ADDR,
      totalEarned: "80000", // demo cumulative (80% of charged)
      latestPayout: "40000", // demo latest split
    },
    settlements,
    latestResult: null,
    connected: false,
    isDemo: true,
  };
}

/**
 * Live event stream for the demo dashboard.
 *
 * Today this returns obviously-placeholder demo data so the three-pane layout
 * renders without a backend. The real implementation subscribes to the
 * backend SSE endpoint and updates state from `settlement` events.
 *
 * TODO(backend): once the backend is up, replace `buildDemoState()` with an
 * EventSource subscription, e.g.
 *
 *   const url = process.env.NEXT_PUBLIC_EVENTS_URL; // e.g. http://localhost:PORT/events/stream
 *   const es = new EventSource(url);
 *   es.addEventListener("settlement", (e) => {
 *     const evt = JSON.parse(e.data) as SettlementEvent;
 *     // prepend to settlements, push a CallRecord, decrement agent.balance,
 *     // bump creator.totalEarned / latestPayout, set connected = true.
 *   });
 *   return () => es.close();
 *
 * Until then `isDemo` stays true and `connected` stays false so the UI can
 * label the data as a placeholder rather than imply a live feed.
 */
export function useEventStream(): EventStreamState {
  const [state] = React.useState<EventStreamState>(buildDemoState);
  return state;
}
