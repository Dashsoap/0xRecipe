# @0xrecipe/web

0xRecipe 演示前端：一页三栏的实时看板，展示 agent 预付调用、链上原子分账、创作者即时收入。

> 当前是**假数据脚手架**：页面用占位数据（明显的演示地址 / 金额）驱动，尚未连接后端事件流。地址与金额仅用于演示，不代表任何真实业务。

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
| **链上浏览器** | 结算交易的内嵌视图（当前为占位，后续指向链上交易页） |

## 数据来源

页面数据来自 `src/hooks/useEventStream.ts`。

- 现在：返回演示占位数据，`isDemo` 为 `true`，页面右上角标注「演示数据 · 占位」。
- 后续：订阅后端事件流（`NEXT_PUBLIC_EVENTS_URL`），收到结算事件后实时更新余额、调用列表与创作者收入。接线点已在 hook 内以注释标出。

## 配置

仅使用 `NEXT_PUBLIC_*` 公开、非敏感配置（公共 RPC / 浏览器地址 / 事件流地址）。**不读取 `.env` 内容，不写死任何密钥或私钥。** 缺省时回退到公共测试网端点：

| 变量 | 用途 | 缺省 |
|---|---|---|
| `NEXT_PUBLIC_RPC_URL` | 链上 RPC | 公共测试网 RPC |
| `NEXT_PUBLIC_EXPLORER_URL` | 链上浏览器地址 | 公共测试网浏览器 |
| `NEXT_PUBLIC_EVENTS_URL` | 后端事件流地址（后续接入） | — |

## 技术栈

Next.js 15（App Router）· TypeScript · Tailwind · wagmi / viem · TanStack Query。UI 组件为手写的最小 shadcn 风格组件（`src/components/ui/`），API 与 shadcn 兼容，便于日后用 `shadcn add` 平滑替换。
