# @0xrecipe/web

0xRecipe 演示前端：一页三栏的实时看板，展示 agent 预付调用、链上原子分账、创作者即时收入。

页面已连接后端事件流与余额 API。没有真实 settlement 事件或 demo agent
地址时，界面显示明确的等待/待配置状态，不渲染假交易或假余额。

## 启动

```bash
pnpm dev        # 本地开发服务器
pnpm build      # 生产构建
pnpm start      # 运行生产构建
pnpm typecheck  # 类型检查
pnpm lint       # 代码检查
```

依赖在仓库根目录统一安装（`pnpm install`），本包不单独安装。

## 三栏用途

| 栏目 | 内容 |
|---|---|
| **Agent 视角** | 钱包地址、可用余额、预算用量条、最近调用列表（点击交易可跳转链上浏览器） |
| **Creator 视角** | 收款地址、累计收入、本次分账高亮卡片 |
| **链上浏览器** | 实时 settlement feed，交易哈希可跳转 Injective testnet explorer |

页面顶部还会显示后端健康状态，包括 escrow/splitter、backend signer、标准源、
官方源与 mock 开关。Agent 视角会根据 `/v1/recipes` 的当前价格显示余额还能
调用几次。

## 数据来源

页面数据来自：

- `src/hooks/useEventStream.ts`：订阅后端 `GET /events/stream`，收到
  settlement 后实时更新调用列表、创作者收入与 explorer feed。
- `src/hooks/useAgentBalance.ts`：读取 `GET /v1/balance/:agent`，并在每次
  settlement 后刷新 demo agent 的 escrow 余额。
- `src/hooks/useBackendHealth.ts`：读取 `GET /health`，展示当前依赖状态。
- `src/hooks/useRecipes.ts`：读取 `GET /v1/recipes`，展示当前价格与可调用次数。

## 配置

仅使用 `NEXT_PUBLIC_*` 公开、非敏感配置。**不读取任何密钥或私钥。**
缺省时连接本地后端：

| 变量 | 用途 | 缺省 |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | 后端 HTTP base，用于 balance/usage reads | `http://localhost:3001` |
| `NEXT_PUBLIC_EVENTS_URL` | 后端 SSE settlement stream | `${NEXT_PUBLIC_API_BASE}/events/stream` |
| `NEXT_PUBLIC_DEMO_AGENT` | 前端展示并读取余额的 agent 地址 | 未配置时显示 zero placeholder |

## 技术栈

Next.js 15（App Router）· TypeScript · Tailwind · wagmi / viem · TanStack Query。UI 组件为手写的最小 shadcn 风格组件（`src/components/ui/`），API 与 shadcn 兼容，便于日后用 `shadcn add` 平滑替换。
