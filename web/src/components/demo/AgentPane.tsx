"use client";

import * as React from "react";
import { ArrowUpRight } from "@phosphor-icons/react";

import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/ui/glass-panel";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Beam } from "@/components/visuals/Beam";
import { explorerTxUrl } from "@/lib/chain";
import {
  formatUsdc,
  shortenAddress,
  shortenHash,
  timeAgo,
} from "@/lib/format";
import type { CallRecord } from "@/hooks/useEventStream";

export interface AgentPaneProps {
  address: string;
  /** False when no agent address is configured (zero placeholder shown). */
  addressConfigured: boolean;
  /** Remaining escrow balance in USDC base units, or null when unknown. */
  balanceUnits: string | null;
  /** True when the balance read failed (vs. simply still loading). */
  balanceUnavailable: boolean;
  /** 0 to 100, share of funds consumed this session. */
  usedPct: number;
  /** Amount spent this session, USDC base units. */
  spent: string;
  /** Spent + remaining, USDC base units, or null when balance is unknown. */
  total: string | null;
  recentCalls: CallRecord[];
}

/**
 * Agent pane - the paying side. Double-Bezel glass with a cyan accent: wallet
 * address in mono, a large available-balance figure, a neon budget meter, and
 * a recent-calls list where each settled row carries a faint funds-flow beam
 * and links out to the on-chain transaction. The panel itself rests quiet
 * (hairline ring only); glow is reserved for the funds-flow beam and meter.
 *
 * Balance is read live from the backend. When no address is configured, or the
 * read fails, the figure shows a dash and an honest note — never an invented
 * number.
 */
export function AgentPane({
  address,
  addressConfigured,
  balanceUnits,
  balanceUnavailable,
  usedPct,
  spent,
  total,
  recentCalls,
}: AgentPaneProps) {
  const balanceNote = !addressConfigured
    ? "尚未配置链上地址,余额暂不可用"
    : balanceUnavailable
      ? "暂时无法读取余额,请稍后重试"
      : balanceUnits === null
        ? "读取中…"
        : null;

  return (
    <GlassPanel
      glow="none"
      className="h-full transition-colors duration-700 ease-spring hover:ring-white/15"
      innerClassName="flex h-full flex-col p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-medium tracking-tight text-white">
            调用方视角
          </h3>
          <p className="mt-1 text-sm text-white/50">
            钱包余额、预算与最近调用
          </p>
        </div>
        <Badge variant="cyan" className="shrink-0">
          付费方
        </Badge>
      </div>

      <div className="mt-6 flex flex-1 flex-col gap-6">
        <Field label="钱包地址">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-white/85">
              {shortenAddress(address)}
            </span>
            {!addressConfigured ? (
              <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-white/45 ring-1 ring-white/10">
                待配置
              </span>
            ) : null}
          </div>
        </Field>

        <div className="space-y-1.5">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            可用余额
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={
                balanceUnits !== null
                  ? "font-mono text-4xl font-semibold tracking-tight text-white"
                  : "font-mono text-4xl font-semibold tracking-tight text-white/25"
              }
            >
              {balanceUnits !== null ? formatUsdc(balanceUnits) : "—"}
            </span>
            <span className="text-xs text-white/40">USDC</span>
          </div>
          {balanceNote ? (
            <p className="text-xs text-white/40">{balanceNote}</p>
          ) : null}
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-[0.16em] text-white/40">
              余额消耗
            </span>
            <span className="font-mono text-white/70">
              {total !== null ? (
                <>
                  {formatUsdc(spent)} / {formatUsdc(total)}
                </>
              ) : (
                <span className="text-white/40">—</span>
              )}
            </span>
          </div>
          <Progress value={usedPct} tone="cyan" />
        </div>

        <Separator />

        <div className="flex flex-1 flex-col gap-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
            最近调用
          </div>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-white/40">暂无调用记录</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {recentCalls.map((call) => (
                <li key={call.id}>
                  <CallRow call={call} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </GlassPanel>
  );
}

/** A single recent-call row: recipe + tx link on the left, amount + time on
 * the right, with a faint cyan funds-flow beam threaded across the top edge for
 * settled calls. Non-settled rows stay neutral (no off-palette colour). */
function CallRow({ call }: { call: CallRecord }) {
  const settled = call.status === "settled";
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/[0.07] transition-colors duration-500 ease-spring hover:bg-white/[0.05] hover:ring-white/15">
      {settled ? (
        <Beam
          color="cyan"
          showTrack={false}
          className="absolute inset-x-3 top-0 opacity-50"
        />
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white/90">
            {call.recipe}
          </div>
          <a
            href={explorerTxUrl(call.txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-white/40 underline-offset-4 transition-colors duration-500 ease-spring hover:text-cyan hover:underline"
          >
            {shortenHash(call.txHash)}
            <ArrowUpRight weight="light" className="h-3 w-3" aria-hidden />
          </a>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm font-medium text-white/90">
            −{formatUsdc(call.amount)}
          </div>
          <div className="mt-0.5 text-[11px] text-white/40">
            {settled ? timeAgo(call.timestamp) : "未结算"}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
        {label}
      </div>
      {children}
    </div>
  );
}
