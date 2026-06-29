# 0xRecipe

> Injective 上的 **Fusion 模型市場**——任何人都能上架 Fusion 配方並自主定價；AI agent 無需 API Key、無需註冊，靠 x402 鏈上付費調用，付款經 Splitter 合約原子分賬給創作者與平台。

**參賽**：Injective 新星計劃（Web3Labs / Ninja Labs）

---

## 承重三柱

1. **x402 鏈上結算**——agent 用穩定幣按次付費，無需 API Key 或註冊
2. **鏈上原子分賬**——付款經 `FusionPayoutSplitter` 合約在全價上 20/80 拆賬：平台主導運營、拿 80% 並墊付上游算力成本，創作者拿 20% 返佣、不擔成本
3. **Agent 自主付費調用 Fusion**——多模型 panel + judge 結構化合成

## 運作方式

```
AI agent ──預付 USDC（一次，gasless）──► AgentEscrow（鏈上托管）
   │
   │  每次調用：簽一張付款憑證 → 後端驗簽 + 查鏈上餘額
   │     成功才結算：charge() 一筆原子交易
   │       扣費 + FusionPayoutSplitter 分賬（創作者 20% / 平台 80%）
   ▼
後端跑 Fusion（多模型 panel + judge 合成）──► 結構化結果 + 鏈上交易哈希
```

- **預付即托管**：agent 用 EIP-3009 gasless 授權一次性把 USDC 簽進鏈上 escrow，餘額可隨時取回。
- **失敗不扣費 · 結算才確認**：只有調用成功才扣費，且等鏈上收據確認才算結算。
- **預算牆**：餘額不足回 403，agent 自行推理是否充值（不是 402、不重簽）。
- **Agent 自助**：可自行查餘額 / 帳單 / 充值，全程無需人工或註冊。

## 技術棧

- **合約**：Solidity 0.8.28 + Foundry（`AgentEscrow` + `FusionPayoutSplitter`，ReentrancyGuard + 嚴格 CEI）
- **後端**：TypeScript + Hono + viem；模型統一走 OpenAI 相容介面（以 `.env` 設定）
- **前端**：Next.js 15 + wagmi/viem
- **鏈**：Injective EVM testnet（chainId 1439），穩定幣 USDC

## 快速開始

```bash
pnpm install

# 合約測試
pnpm test:contracts                                  # 或 forge test --root contracts

# 後端：型別檢查 + 測試（純本地、無需網路）
pnpm --filter @0xrecipe/backend run typecheck
NODE_ENV=test pnpm --filter @0xrecipe/backend run test

# Demo 前檢查 / 故障排除
pnpm doctor            # 檢查 env、部署合約、signer、recipe、agent escrow balance
pnpm e2e:dry-run       # 驗證 Fusion 失敗時不扣款、不發 settlement
pnpm gateway:smoke     # 填好 LLM key 後先測 OpenAI-compatible gateway

# 開發伺服器（後端需先填 repo-root .env，可由 .example.env 複製）
pnpm dev:backend
pnpm dev:web
```

合約部署位址記錄於 `contracts/deployments/injective-testnet-1439.json`。

## API（agent 自助）

| 端點 | 說明 |
|---|---|
| `POST /v1/chat/completions` | 付費 Fusion 調用（帶簽名付款憑證） |
| `GET  /v1/balance/:agent` | 查鏈上預付餘額 |
| `GET  /v1/usage/:agent` | 查帳單（充值 + 已結算扣費，新到舊） |
| `GET  /v1/recipes` | 查目前配方、價格與 panel size |
| `GET  /v1/deposit/info` | 取得簽署預付授權所需參數 |
| `POST /v1/deposit` | 提交簽好的 gasless 預付，relay 進 escrow |
| `GET  /events/stream` | 結算事件 SSE 串流 |

## 狀態

- ✅ 合約 + 鏈上 20/80 原子分賬（已部署 testnet 並實測驗證）
- ✅ 後端支付核心：憑證驗簽 → 償付檢查 → Fusion → 原子結算（型別檢查 / 測試全綠）
- ✅ Agent 自助 API（餘額 / 帳單 / 充值）
- ✅ 配方與定價可後台管理、運行時調整（不重啟、不動合約）
- ✅ 端到端 Fusion 調用 + 自主 agent demo
- 🗺️ 路線圖：付款憑證上鏈做信任最小化、token 計量計費、多配方市場

## 文件

產品敘事見 [PLAN.md](./PLAN.md)。
