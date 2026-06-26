"use client";

import * as React from "react";
import type { SettlementEvent } from "@0xrecipe/shared";

import { EVENTS_URL } from "@/lib/api";

/**
 * One row in the Agent view's recent-calls list, derived from a settlement:
 * which recipe was invoked, how much was charged, and the on-chain tx.
 */
export interface CallRecord {
  id: string;
  /** Display label for the call. */
  recipe: string;
  /** Charged amount, in USDC base units (6 decimals), as a string. */
  amount: string;
  txHash: string;
  /** Unix epoch milliseconds. */
  timestamp: number;
  status: "settled" | "rejected";
}

/** Connection state of the settlement stream. */
export type StreamStatus = "connecting" | "open" | "error";

export interface EventStreamState {
  /** Settlement events, newest first. Empty until the first event arrives. */
  settlements: SettlementEvent[];
  /** Live connection state of the event stream. */
  status: StreamStatus;
}

/** Keep the in-memory feed bounded; the explorer only ever shows the latest. */
const MAX_SETTLEMENTS = 50;

/** Narrow unknown JSON to a SettlementEvent before trusting any field. */
function isSettlementEvent(value: unknown): value is SettlementEvent {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === "settlement" &&
    typeof v.agent === "string" &&
    typeof v.creator === "string" &&
    typeof v.amount === "string" &&
    typeof v.txHash === "string" &&
    typeof v.recipeId === "string" &&
    typeof v.ts === "number"
  );
}

/**
 * Subscribe to the backend's server-sent settlement stream.
 *
 * SSR-safe: the EventSource is only opened inside an effect (never on the
 * server or during the first render), so the initial markup is the empty,
 * "connecting" state on both server and client — no hydration mismatch.
 *
 * Exposes the running list of settlements (newest first) and the connection
 * status. The browser's EventSource auto-reconnects after a drop; we surface
 * "error" while it retries and flip back to "open" once it reconnects. No
 * data is ever fabricated — an empty list means no settlements have arrived.
 */
export function useEventStream(): EventStreamState {
  const [settlements, setSettlements] = React.useState<SettlementEvent[]>([]);
  const [status, setStatus] = React.useState<StreamStatus>("connecting");

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return;
    }

    let closed = false;

    const ingest = (raw: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return; // ignore keep-alive pings and any non-JSON frames
      }
      if (!isSettlementEvent(parsed)) return;
      const event = parsed;
      setSettlements((prev) => {
        // De-dupe on tx hash so a reconnect replay can't double-count.
        if (prev.some((s) => s.txHash === event.txHash)) return prev;
        return [event, ...prev].slice(0, MAX_SETTLEMENTS);
      });
    };

    let source: EventSource;
    try {
      source = new EventSource(EVENTS_URL);
    } catch {
      setStatus("error");
      return;
    }

    source.onopen = () => {
      if (!closed) setStatus("open");
    };
    source.onerror = () => {
      // EventSource transitions to CONNECTING and retries on its own; reflect
      // the interruption honestly while it does.
      if (!closed) setStatus("error");
    };
    // Backend tags settlement frames with `event: settlement`.
    source.addEventListener("settlement", (e) =>
      ingest((e as MessageEvent).data),
    );
    // Also accept default-typed frames in case a producer omits the event name.
    source.onmessage = (e) => ingest(e.data);

    return () => {
      closed = true;
      source.close();
    };
  }, []);

  return { settlements, status };
}
