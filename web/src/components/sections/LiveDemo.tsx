"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/visuals/Reveal";
import { useEventStream, type CallRecord } from "@/hooks/useEventStream";
import { useAgentBalance } from "@/hooks/useAgentBalance";
import { AgentPane } from "@/components/demo/AgentPane";
import { CreatorPane } from "@/components/demo/CreatorPane";
import { ExplorerPane } from "@/components/demo/ExplorerPane";
import { DEMO_AGENT, DEMO_AGENT_IS_SET } from "@/lib/api";
import { creatorShareUnits, sumUnits } from "@/lib/format";

/**
 * LiveDemo (id="demo") — the second surface. The heading carries the section
 * on its own (no eyebrow; the single site eyebrow lives in the hero). Three
 * glass panes sit in an asymmetric bento grid: the paying agent and the
 * earning creator side by side on top, the on-chain explorer spanning beneath.
 *
 * All data is live: settlements arrive over the event stream and the agent's
 * escrow balance is read from the backend, refreshed on each settlement. Until
 * the first event arrives every pane shows an honest waiting state — nothing is
 * fabricated.
 */
export function LiveDemo() {
  const { settlements, status } = useEventStream();

  const agentAddress = DEMO_AGENT;
  const agentBalance = useAgentBalance(
    DEMO_AGENT_IS_SET ? agentAddress : null,
    settlements.length,
  );

  // The agent pane is one wallet's view: only its own settlements feed it.
  const agentSettlements = React.useMemo(
    () =>
      settlements.filter(
        (s) => s.agent.toLowerCase() === agentAddress.toLowerCase(),
      ),
    [settlements, agentAddress],
  );

  const spentUnits = React.useMemo(
    () => sumUnits(agentSettlements.map((s) => s.amount)),
    [agentSettlements],
  );

  const balanceKnown =
    agentBalance.status === "ready" && agentBalance.balanceUnits !== null;

  // Budget bar: consumed this session relative to (consumed + remaining). Only
  // meaningful once we have a real balance; otherwise the bar reads zero.
  const totalUnits = balanceKnown
    ? sumUnits([spentUnits, agentBalance.balanceUnits as string])
    : null;
  const usedPct =
    totalUnits && Number(totalUnits) > 0
      ? (Number(spentUnits) / Number(totalUnits)) * 100
      : 0;

  const recentCalls: CallRecord[] = React.useMemo(
    () =>
      agentSettlements.slice(0, 6).map((s) => ({
        id: s.txHash,
        recipe: "配方调用",
        amount: s.amount,
        txHash: s.txHash,
        timestamp: s.ts,
        status: "settled" as const,
      })),
    [agentSettlements],
  );

  // Creator side: cumulative 20% across every settlement, plus the latest split.
  const creatorEarnedUnits = React.useMemo(
    () => sumUnits(settlements.map((s) => creatorShareUnits(s.amount))),
    [settlements],
  );
  const latest = settlements[0] ?? null;
  const latestCreatorCut = latest ? creatorShareUnits(latest.amount) : "0";

  return (
    <section
      id="demo"
      className="mx-auto w-full max-w-7xl px-4 py-28 md:py-40"
      aria-label="实时演示"
    >
      <Reveal>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <h2 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
              一次付费,按调用扣费,
              <br className="hidden sm:block" />
              链上原子分账
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-white/55">
              调用方预付一笔余额,每次调用按量扣费;合约把款项原子地分给创作者与平台,实时可查。
            </p>
          </div>
          <ConnectionBadge status={status} />
        </div>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Reveal delay={0.05} className="h-full">
          <AgentPane
            address={agentAddress}
            addressConfigured={DEMO_AGENT_IS_SET}
            balanceUnits={balanceKnown ? (agentBalance.balanceUnits as string) : null}
            balanceUnavailable={agentBalance.status === "error"}
            usedPct={usedPct}
            spent={spentUnits}
            total={totalUnits}
            recentCalls={recentCalls}
          />
        </Reveal>

        <Reveal delay={0.12} className="h-full">
          <CreatorPane
            address={latest?.creator ?? null}
            totalEarned={creatorEarnedUnits}
            latestPayout={latestCreatorCut}
            latestTxHash={latest?.txHash ?? null}
            hasLatest={settlements.length > 0}
          />
        </Reveal>

        <Reveal delay={0.18} className="lg:col-span-2">
          <ExplorerPane settlements={settlements} status={status} />
        </Reveal>
      </div>
    </section>
  );
}

/** Honest live-connection indicator for the event stream. */
function ConnectionBadge({
  status,
}: {
  status: "connecting" | "open" | "error";
}) {
  const map = {
    connecting: {
      variant: "default" as const,
      dot: "bg-white/40",
      label: "连接中…",
    },
    open: {
      variant: "emerald" as const,
      dot: "bg-emerald shadow-glow-emerald",
      label: "实时连接",
    },
    error: {
      variant: "destructive" as const,
      dot: "bg-red-400",
      label: "连接中断 · 重试中",
    },
  }[status];

  return (
    <Badge
      variant={map.variant}
      className="shrink-0 gap-2 self-start sm:self-auto"
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${map.dot}`} />
      {map.label}
    </Badge>
  );
}
