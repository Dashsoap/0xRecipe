"use client";

import * as React from "react";
import { ArrowRight, ArrowUpRight, LinkSimple } from "@phosphor-icons/react";
import type { SettlementEvent } from "@0xrecipe/shared";

import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Beam } from "@/components/visuals/Beam";
import { explorerTxUrl } from "@/lib/chain";
import {
  creatorShareUnits,
  formatUsdc,
  shortenAddress,
  shortenHash,
} from "@/lib/format";
import type { StreamStatus } from "@/hooks/useEventStream";

export interface ExplorerPaneProps {
  /** Settlement events, newest first. */
  settlements: SettlementEvent[];
  /** Live connection state of the event stream. */
  status: StreamStatus;
}

/**
 * Explorer pane - the on-chain window. Double-Bezel glass framing a recessed
 * viewport. Once settlements arrive the viewport fills with a live feed: each
 * row shows the paying agent, the charged amount, the creator's 20% cut, and a
 * link to the transaction on the public explorer. Until a real settlement
 * exists the viewport shows an honest waiting / disconnected state — no
 * fabricated rows are ever rendered.
 */
export function ExplorerPane({ settlements, status }: ExplorerPaneProps) {
  const hasRows = settlements.length > 0;

  return (
    <GlassPanel
      glow="none"
      className="h-full transition-colors duration-700 ease-spring hover:ring-white/15"
      innerClassName="flex h-full flex-col p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-tight text-white">
            链上浏览器
          </h3>
          <p className="mt-1 text-sm text-white/50">结算交易实时查看</p>
        </div>
        <Badge variant="violet" className="shrink-0">
          链上
        </Badge>
      </div>

      <div className="mt-6 flex flex-1 flex-col">
        <div className="relative flex min-h-[20rem] flex-1 flex-col overflow-hidden rounded-2xl bg-ink-base ring-1 ring-white/[0.07]">
          {hasRows ? (
            <ul className="flex max-h-[28rem] flex-col gap-2.5 overflow-y-auto p-4">
              {settlements.map((s) => (
                <li key={s.txHash}>
                  <SettlementRow event={s} />
                </li>
              ))}
            </ul>
          ) : (
            <WaitingState status={status} />
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/** One live settlement: agent → creator funds flow on the left with a tx link,
 * charged amount and the creator's 20% cut on the right. A faint violet beam
 * threads the top edge to echo the on-chain arrival. */
function SettlementRow({ event }: { event: SettlementEvent }) {
  const creatorCut = creatorShareUnits(event.amount);
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.03] p-3.5 ring-1 ring-white/[0.07] transition-colors duration-500 ease-spring hover:bg-white/[0.05] hover:ring-white/15">
      <Beam
        color="violet"
        showTrack={false}
        className="absolute inset-x-3 top-0 opacity-50"
      />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-white/85">
              {shortenAddress(event.agent)}
            </span>
            <ArrowRight
              weight="light"
              className="h-3.5 w-3.5 shrink-0 text-white/30"
              aria-hidden
            />
            <span className="font-mono text-white/55">
              {shortenAddress(event.creator)}
            </span>
          </div>
          <a
            href={explorerTxUrl(event.txHash)}
            target="_blank"
            rel="noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs text-white/40 underline-offset-4 transition-colors duration-500 ease-spring hover:text-violet hover:underline"
          >
            {shortenHash(event.txHash)}
            <ArrowUpRight weight="light" className="h-3 w-3" aria-hidden />
          </a>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-medium text-white/90">
            {formatUsdc(event.amount)}
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-emerald/80">
            创作者 +{formatUsdc(creatorCut)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Honest empty / connecting / disconnected state — never fabricated rows. */
function WaitingState({ status }: { status: StreamStatus }) {
  const copy =
    status === "error"
      ? {
          title: "暂时无法连接服务",
          body: "正在自动重试,恢复后交易将在此实时呈现",
        }
      : status === "connecting"
        ? {
            title: "正在连接服务",
            body: "结算交易将在此实时呈现",
          }
        : {
            title: "暂无结算交易",
            body: "下一笔调用结算后,交易将在此实时呈现",
          };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <WaitingMark />
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white/80">{copy.title}</p>
        <p className="text-xs leading-relaxed text-white/40">{copy.body}</p>
      </div>
    </div>
  );
}

/** Thin link glyph with a soft breathing pulse - the single focal hint in an
 * otherwise empty pane, signalling an on-chain stream that has not started. */
function WaitingMark() {
  return (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-violet/10 ring-1 ring-violet/25">
      <div className="absolute inset-0 animate-pulse-glow rounded-full shadow-glow-violet" />
      <LinkSimple
        weight="light"
        className="relative h-6 w-6 text-violet"
        aria-hidden
      />
    </div>
  );
}
