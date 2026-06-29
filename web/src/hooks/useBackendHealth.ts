"use client";

import * as React from "react";

import { healthUrl } from "@/lib/api";

export interface BackendHealth {
  status: "ok";
  chainId: number;
  mock: {
    chain: boolean;
    fusion: boolean;
  };
  configured: {
    escrow: boolean;
    splitter: boolean;
    backendWallet: boolean;
    standardSource: boolean;
    officialSource: boolean;
  };
}

export function useBackendHealth(): {
  health: BackendHealth | null;
  status: "loading" | "ready" | "error";
} {
  const [health, setHealth] = React.useState<BackendHealth | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    let cancelled = false;
    fetch(healthUrl())
      .then(async (res) => {
        if (!res.ok) throw new Error(`health ${res.status}`);
        return (await res.json()) as BackendHealth;
      })
      .then((data) => {
        if (cancelled) return;
        setHealth(data);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { health, status };
}
