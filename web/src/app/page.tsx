"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { explorerTxUrl } from "@/lib/chain";
import {
  formatUsdc,
  shortenAddress,
  shortenHash,
  timeAgo,
} from "@/lib/format";
import { useEventStream } from "@/hooks/useEventStream";

export default function Page() {
  const stream = useEventStream();
  const { agent, creator, settlements, isDemo } = stream;

  const spent = Number(agent.budgetSpent);
  const total = Number(agent.budgetTotal);
  const usedPct = total > 0 ? (spent / total) * 100 : 0;

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <header className="mx-auto mb-6 flex max-w-7xl flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">0xRecipe</h1>
          <p className="text-sm text-muted-foreground">
            Fusion 模型市场 · 预付一次，按调用扣费，链上原子分账
          </p>
        </div>
        {isDemo ? (
          <Badge variant="outline" className="self-start sm:self-auto">
            演示数据 · 占位
          </Badge>
        ) : null}
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 lg:grid-cols-3">
        <AgentPane
          address={agent.address}
          balance={agent.balance}
          usedPct={usedPct}
          spent={agent.budgetSpent}
          total={agent.budgetTotal}
          recentCalls={agent.recentCalls}
        />
        <CreatorPane
          address={creator.address}
          totalEarned={creator.totalEarned}
          latestPayout={creator.latestPayout}
          hasLatest={settlements.length > 0}
        />
        <ExplorerPane />
      </div>
    </main>
  );
}

// --- Agent view ---------------------------------------------------------

function AgentPane({
  address,
  balance,
  usedPct,
  spent,
  total,
  recentCalls,
}: {
  address: `0x${string}`;
  balance: string;
  usedPct: number;
  spent: string;
  total: string;
  recentCalls: ReturnType<typeof useEventStream>["agent"]["recentCalls"];
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Agent 视角</CardTitle>
        <CardDescription>钱包余额、预算与最近调用</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">钱包地址</div>
          <div className="font-mono text-sm">{shortenAddress(address)}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">可用余额</div>
          <div className="text-2xl font-semibold">{formatUsdc(balance)}</div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>预算用量</span>
            <span>
              {formatUsdc(spent)} / {formatUsdc(total)}
            </span>
          </div>
          <Progress value={usedPct} />
        </div>

        <Separator />

        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">最近调用</div>
          {recentCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无调用记录</p>
          ) : (
            <ul className="space-y-2">
              {recentCalls.map((call) => (
                <li
                  key={call.id}
                  className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{call.recipe}</div>
                    <a
                      href={explorerTxUrl(call.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {shortenHash(call.txHash)}
                    </a>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-medium">
                      −{formatUsdc(call.amount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(call.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Creator view -------------------------------------------------------

function CreatorPane({
  address,
  totalEarned,
  latestPayout,
  hasLatest,
}: {
  address: `0x${string}`;
  totalEarned: string;
  latestPayout: string;
  hasLatest: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>Creator 视角</CardTitle>
        <CardDescription>配方累计收入与本次分账</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">收款地址</div>
          <div className="font-mono text-sm">{shortenAddress(address)}</div>
        </div>

        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">累计收入</div>
          <div className="text-2xl font-semibold">
            {formatUsdc(totalEarned)}
          </div>
        </div>

        <Separator />

        <div className="rounded-lg border bg-secondary/40 p-4">
          <div className="text-xs text-muted-foreground">本次分账</div>
          {hasLatest ? (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-emerald-600">
                +{formatUsdc(latestPayout)}
              </span>
              <span className="text-xs text-muted-foreground">
                链上即时到账
              </span>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              等待下一次调用结算
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// --- On-chain explorer --------------------------------------------------

function ExplorerPane() {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle>链上浏览器</CardTitle>
        <CardDescription>结算交易实时查看</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {/*
          Placeholder iframe. Once a settlement tx exists, point src at the
          explorer tx page, e.g. explorerTxUrl(latestSettlement.txHash) on the
          Injective EVM testnet Blockscout. Kept as about:blank so the demo
          scaffold renders without a live transaction.
        */}
        <div className="h-full min-h-[20rem] overflow-hidden rounded-md border">
          <iframe
            title="链上浏览器"
            src="about:blank"
            className="h-full min-h-[20rem] w-full bg-muted"
          />
        </div>
      </CardContent>
    </Card>
  );
}
