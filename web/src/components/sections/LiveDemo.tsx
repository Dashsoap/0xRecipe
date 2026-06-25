"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/visuals/Reveal";
import { useEventStream } from "@/hooks/useEventStream";
import { AgentPane } from "@/components/demo/AgentPane";
import { CreatorPane } from "@/components/demo/CreatorPane";
import { ExplorerPane } from "@/components/demo/ExplorerPane";

/**
 * LiveDemo (id="demo") — the second surface. An eyebrow + editorial heading
 * introduce three glass panes laid out as an asymmetric bento grid: the
 * paying agent and the earning creator side by side on top, the on-chain
 * explorer spanning beneath them. Data comes from useEventStream; while it is
 * placeholder the section is clearly badged as demo.
 */
export function LiveDemo() {
  const stream = useEventStream();
  const { agent, creator, settlements, isDemo } = stream;

  const spent = Number(agent.budgetSpent);
  const total = Number(agent.budgetTotal);
  const usedPct = total > 0 ? (spent / total) * 100 : 0;

  return (
    <section
      id="demo"
      className="mx-auto w-full max-w-7xl px-4 py-28 md:py-40"
      aria-label="实时演示"
    >
      <Reveal>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-4">
            <Badge variant="eyebrow">Live Demo</Badge>
            <h2 className="max-w-2xl text-4xl font-semibold leading-[1.05] tracking-tight text-white md:text-6xl">
              一次付费,按调用扣费,
              <br className="hidden sm:block" />
              链上原子分账
            </h2>
            <p className="max-w-xl text-base leading-relaxed text-white/55">
              调用方预付一笔余额,每次调用按量扣费;合约把款项原子地分给创作者与平台,实时可查。
            </p>
          </div>
          {isDemo ? (
            <Badge
              variant="default"
              className="shrink-0 gap-2 self-start sm:self-auto"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/40" />
              演示数据 · 占位
            </Badge>
          ) : null}
        </div>
      </Reveal>

      <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Reveal delay={0.05} className="h-full">
          <AgentPane
            address={agent.address}
            balance={agent.balance}
            usedPct={usedPct}
            spent={agent.budgetSpent}
            total={agent.budgetTotal}
            recentCalls={agent.recentCalls}
          />
        </Reveal>

        <Reveal delay={0.12} className="h-full">
          <CreatorPane
            address={creator.address}
            totalEarned={creator.totalEarned}
            latestPayout={creator.latestPayout}
            hasLatest={settlements.length > 0}
          />
        </Reveal>

        <Reveal delay={0.18} className="lg:col-span-2">
          <ExplorerPane />
        </Reveal>
      </div>
    </section>
  );
}
