# 0xRecipe — 4-Day MVP 計畫

> **一句話定位**：Injective 上的「Fusion 模型市場」——任何人都能上架 Fusion 配方並自主定價；AI agent 無需 API Key、無需註冊，靠 x402 鏈上付費調用，付款經 Splitter 合約原子分賬給創作者與平台。
>
> **參賽**：Injective 新星計劃（Web3Labs / Ninja Labs）
> **時程**：4 個工作日 MVP
> **承重三柱**：x402 鏈上結算 + 鏈上原子分賬 + agent 自主付費調用 Fusion

---

## 1. 已鎖定的設計決策（10 條）

來自設計會議的承重決策，4 天執行期內不再變動。

| # | 領域 | 決策 |
|---|---|---|
| D1 | 合約形態 | `FusionPayoutSplitter` + `AgentBudget`（極薄合約） |
| D2 | 分賬比例 | 固定 80/20（創作者 80%、平台 20%） |
| D3 | Agent 身份 | EOA 錢包 + 後端護欄判斷 + 鏈上 audit event（**不做 ERC-4337**） |
| D4 | Fusion 引擎 | **自建** panel(≤3) + judge，judge 輸出結構化 JSON（consensus/contradictions/blind spots） |
| D5 | 模型支援 | Panel：GPT + Claude；Judge：固定選單 |
| D6 | 防作弊 | 發布時校驗 `price ≥ 預估上游成本 × 2`；配方發布後不可改 |
| D7 | Demo Agent | Mastra + viem + x402 SDK，多步驟 loop，自主市場發現 |
| D8 | Demo 形式 | 一鏡到底錄製（不剪接造假） |
| D9 | 前端 | 1 個 surface（Demo View 一頁），Next.js + shadcn + viem + wagmi |
| D10 | 定價模型 | 按次 fixed price，x402 `exact` scheme |

### 4 天版本的進一步砍裁（D11-D15）

| # | 砍裁 | 替代方案 |
|---|---|---|
| D11 | 創作者發布表單**砍**，hard-code 一個 `LegalReviewer` 配方寫死 | V1 補回 |
| D12 | 排行榜**砍**，前端展示靜態 TOP 3 假數據 | V1 補回 |
| D13 | 多配方**砍**，全 demo 只有一個配方 | V1 補回 |
| D14 | `AgentBudget` 合約**砍**，預算護欄純後端判斷 + Splitter 合約多一個 `emit AuditEvent` 事件 | V1 補回獨立合約 |
| D15 | sub2api 魔改**砍**，從零寫 ~300 行 backend 比改 sub2api 快 | — |

---

## 2. 系統架構（4 天版）

```
┌────────────┐   1. POST /v1/chat/completions (no Key)   ┌────────────────────────────┐
│  Mastra    │ ─────────────────────────────────────────▶│  0xRecipe Backend          │
│  Agent     │ ◀── 2. 402 + payment requirements ────── │  (TS/Hono 或 Go)            │
│ (viem+x402)│ ─── 3. retry with X-PAYMENT header ─────▶│  · x402 middleware          │
└────────────┘ ◀── 7. response + tx hash ───────────────│  · Fusion engine (panel+    │
                                                          │     judge, 自建)            │
                                                          │  · hard-coded recipe        │
                                                          │  · budget guardrail (內存)  │
                                                          └─┬────────────┬──────────────┘
                                                            │            │ 5. 並行調用 GPT+Claude
                                                            │ 4. x402    │
                                                            │   verify/  ▼
                                                            │   settle   ┌────────────────┐
                                                            ▼            │ OpenAI +       │
                                ┌─────────────────────────────┐         │ Anthropic API  │
                                │  x402 Facilitator           │         │ (官方 Key)     │
                                │  (Injective EVM testnet)    │         └────────────────┘
                                └──────────────┬──────────────┘
                                               │ 4'. 鏈上分賬
                                               ▼
                       ┌────────────────────────────────────┐
                       │  Injective EVM testnet              │
                       │  · USDC TransferWithAuthorization   │
                       │  · FusionPayoutSplitter.distribute()│
                       │    → 80% creator / 20% platform     │
                       │  · emit AuditEvent (budget log)     │
                       └─────────────────────────────────────┘
```

---

## 3. 4-Day 任務分解

> **時區假設**：每天 4 工作日，從早 10:00 開始、晚上 21:00 收工，中午有 1 小時休息。
> **並行策略**：每天最多開 3 個子 agent 平行做，每天早上 10:00 + 下午 15:00 兩次同步。
> **產出標準**：每天結束時必須有 demo-able 增量（看得到、跑得起來）。

---

### Day 1（一）— Spike + 設計凍結

**核心目標**：當天 23:00 前看到 Injective EVM testnet 區塊瀏覽器上的真實 x402 settlement tx。

**Plan B 觸發點**：23:00 還沒看到 tx hash → **立即切 Base Sepolia**。隔日早上重做 Task 1.2 + 1.3，預期 1-2 小時補回。

#### Stream A（人類主導）：Spike

- [ ] **Task 1.1 環境就緒**（30 分鐘）
  - Injective EVM testnet RPC（公開 endpoint）
  - testnet INJ faucet（gas）
  - testnet USDC（**最大未知數**，必須先確認 faucet 存在；若無，找替代 EIP-3009 stablecoin）
  - 區塊瀏覽器 URL 記下來
- [ ] **Task 1.2 Facilitator 起來**（1-2 小時）
  - Fork `second-state/x402-facilitator` 或檢查 `@injectivelabs/x402` 內建 facilitator
  - 配置指向 Injective EVM testnet RPC
  - 本地跑起來，`/verify` + `/settle` endpoint 通
- [ ] **Task 1.3 Hello world server + client**（2-3 小時）
  - TypeScript + Hono，`GET /hello` 要求 $0.01 USDC
  - Client：未付款收 402、簽 EIP-3009、重試、印出 tx hash
  - **驗收**：tx hash 貼進區塊瀏覽器看到 USDC 轉了
- [ ] **Task 1.4 截圖存檔**（pitch deck 要用）

#### Stream B（子 agent 1）：Splitter 合約

- [ ] **Task 1.5 寫 `FusionPayoutSplitter.sol`**（spike 沒成功也能先寫）
  - 一個 `distribute(address creator)` 函式，把當前 USDC 餘額按 80/20 拆給 creator 和 platform
  - 一個 `AuditEvent(address agent, uint256 amount, string reason)` 事件，給後端護欄記錄用
  - **不部署**（等 Day 2 spike 成功確認鏈再部署）
  - 寫 Foundry 測試覆蓋分賬正確性

#### Stream C（子 agent 2）：前端腳手架

- [ ] **Task 1.6 Next.js 專案初始化**
  - `pnpm create next-app@latest`
  - shadcn/ui 初始化 + 安裝必要組件（Card, Button, Badge, Progress, Toast）
  - viem + wagmi 配置 Injective EVM testnet（custom chain config）
  - 一個 placeholder Demo View 頁面，三欄空版型先擺好

**Day 1 驗收**：
- ✅ 真實 tx hash 在區塊瀏覽器上（或 Plan B 觸發、Base 上跑通）
- ✅ Splitter 合約寫完、測試通過
- ✅ 前端三欄版型空殼跑起來

---

### Day 2（二）— Splitter 部署 + Fusion 引擎 + 前端鋪設

#### Stream A（人類）：Splitter 部署 + 整合

- [ ] **Task 2.1 部署 Splitter 到 Day 1 確認可用的鏈**
  - 用 Foundry script 部署
  - 把合約地址寫進後端 `.env`
  - 手動測試：往 Splitter 轉 $0.05 USDC → 呼叫 `distribute(creator)` → 確認 creator 拿 $0.04、platform 拿 $0.01

#### Stream B（子 agent 1）：Backend Fusion 引擎

- [ ] **Task 2.2 寫 Fusion 後端**
  - **Endpoint**：`POST /v1/chat/completions`
  - **x402 middleware**：接 Day 1 facilitator，付款金額 = recipe 固定 price ($0.05)
  - **付款後流程**：
    1. 把 facilitator settle 的目標地址設為 Splitter
    2. settle 完成 → 在同一筆交易呼叫 `Splitter.distribute(hardcodedCreator)`
    3. 並行 call OpenAI GPT-5.5 + Anthropic Claude（panel 階段，最多 3 模型）
    4. 收集 panel 結果，組成 judge prompt：「Below are N answers from N models, produce JSON: {consensus, contradictions, partial_coverage, unique_insights, blind_spots, synthesized_answer}」
    5. 呼叫 judge model（GPT-5.5 或 Claude-Opus，固定一個）
    6. 回傳結構化 JSON + tx hash 給 caller
  - **Hard-coded recipe**（在程式碼裡寫死）：
    ```ts
    const LEGAL_REVIEWER_RECIPE = {
      id: "legal-reviewer-v1",
      name: "Legal Contract Reviewer",
      price: 0.05, // USDC
      creator_address: "0x...", // 你的測試錢包
      panel: [
        { model: "gpt-5.5", system_prompt: "You are a meticulous contract lawyer. Focus on rent, deposit, penalty clauses..." },
        { model: "claude-opus-4-8", system_prompt: "You are a tenant-rights advocate reviewing this contract..." }
      ],
      judge: { model: "gpt-5.5", instruction: "Synthesize..." }
    }
    ```
  - **SSE endpoint**：`GET /events/stream`，推送 settlement 事件給前端即時更新

#### Stream C（子 agent 2）：前端 Demo View

- [ ] **Task 2.3 寫 Demo View 三欄畫面**
  - 左欄「Agent 視角」：錢包地址、餘額、預算條、最近 N 筆 call 列表（時間、模型、扣款、tx hash 點開連到區塊瀏覽器）
  - 中欄「Creator 視角」：creator 錢包地址、累計收入、本次分賬 highlight 動畫（$0.05 → +$0.04 跳出 toast）
  - 右欄「區塊瀏覽器 iframe」：當前最新 tx 自動跳轉
  - **SSE 客戶端**：訂閱後端 `/events/stream`，收到事件即時更新左+中欄

**Day 2 驗收**：
- ✅ Splitter 部署成功、手動測試分賬正確
- ✅ 用 curl 打 `/v1/chat/completions` → 收 402 → 補付款 → 拿到 Fusion JSON + tx hash
- ✅ 前端三欄畫面跑起來、SSE 訂閱通

---

### Day 3（三）— Mastra Agent + 端到端整合

#### Stream A（人類 + 子 agent）：Mastra Agent

- [ ] **Task 3.1 Mastra Agent 專案**
  - `pnpm create mastra@latest` 或從範本 fork
  - Agent 定義：`LegalReviewerAgent`
    - System prompt：「You are a legal assistant helping users review rental contracts. You have access to a tool `reviewContract(text)` that calls a high-quality Fusion model on 0xRecipe. Budget is provided; reason about it.」
    - Tool：`reviewContract(contractText: string)` → 內部 HTTP call 到 0xRecipe 後端的 `/v1/chat/completions`
- [ ] **Task 3.2 x402 client 封裝**
  - viem 簽 EIP-3009
  - 攔截 402 response → 自動簽 → 重試 → 帶回 tx hash
  - 暴露給 Mastra tool 內部使用
- [ ] **Task 3.3 多步驟 loop 設計**
  - 給 agent 一份 1500 字假租約
  - 預期執行路徑：
    1. agent 讀完合約，決定先請 Fusion 全面審查
    2. call `reviewContract(...)` → 拿到結構化 JSON（含 contradictions）
    3. agent 看到 contradictions，決定追問澄清某條款
    4. 再 call 一次（更具體的問題）
    5. 第三次 call **觸發預算上限** → 收到後端 `insufficient budget` → agent 在 thought 裡解釋並回傳現有結論
  - **預算護欄設定**：總預算 $0.12（剛好容納 2 次 call，第 3 次被拒）

#### Stream B（子 agent）：端到端跑通

- [ ] **Task 3.4 整合測試**
  - 起 facilitator + backend + frontend + Mastra agent 全套
  - 觸發 agent 跑一次完整任務
  - 確認三欄畫面即時更新
  - 確認區塊瀏覽器 iframe 跳轉正確
  - 確認預算護欄第 3 次正確攔截

**Day 3 驗收**：
- ✅ Mastra agent 完整跑通多步驟 loop
- ✅ 前端三欄即時隨 agent 行為更新
- ✅ 預算護欄觸發 + agent 優雅處理

---

### Day 4（四）— 錄製 + Pitch + README

#### 上午：Bug fix + UI polish

- [ ] **Task 4.1 走查 demo 完整跑通 3 次**，每次都成功才算穩定
- [ ] **Task 4.2 UI polish**：toast 動畫、字體、留白、loading state
- [ ] **Task 4.3 區塊瀏覽器 iframe 確認在錄製環境裡能載入**（CORS / X-Frame-Options 檢查）

#### 下午：錄製 demo

- [ ] **Task 4.4 錄製 3 分鐘 demo 影片**
  - 工具：QuickTime Player（macOS 內建）或 Screen Studio（如有授權）
  - 一鏡到底，不剪接造假，可剪去等待空白
  - 對齊 PRD 第 10 節時間表（0:00-0:20 痛點 / 0:20-0:50 創作者上架 / 0:50-1:40 agent 自主付費 / 1:40-2:20 分賬+排行榜+護欄 / 2:20-3:00 收尾）
  - **4 天版調整**：因為砍掉發布表單，0:20-0:50 改為「展示 hard-coded recipe + 解釋未來開放上架」

#### 晚上：Pitch + README

- [ ] **Task 4.5 Pitch Deck**（10 頁）
  - 1: Title + tagline + team
  - 2: 痛點（agent 調 LLM 要管 Key + 好配方沒人能賺錢）
  - 3: 解法（0xRecipe = Injective + x402 + 鏈上分賬 + Fusion 市場）
  - 4: Demo（影片連結 + 區塊瀏覽器截圖）
  - 5: 技術架構圖
  - 6: 競品差異化（vs OpenRouter Fusion / tx402 / Daydreams Router）
  - 7: 商業模型（80/20 + 平台垫付差價）
  - 8: 路線圖（V1 加創作者發布表單 / 排行榜 / stake / AA 護欄）
  - 9: 為什麼選 Injective（650ms 結算 + 生態空白）
  - 10: Ask / Contact
- [ ] **Task 4.6 README + 開源**
  - 一段中英定位 + demo 影片連結
  - Quickstart：如何 local 跑通
  - Tech stack + 架構圖
  - 已知 limitations（hard-coded recipe / 無發布表單 / 無排行榜）
  - V1 路線圖

**Day 4 驗收**：
- ✅ 3 分鐘 demo 影片成片
- ✅ Pitch deck 10 頁完成
- ✅ GitHub repo 公開 + README 寫完

---

## 4. Plan B 觸發條件（必須在 Day 1 23:00 前決定）

| 觸發條件 | 動作 |
|---|---|
| Day 1 23:00 還沒看到 Injective testnet x402 settlement tx | **立即切 Base Sepolia**。後續所有東西跑在 Base。Pitch 改寫：「我們選 Base 作為 MVP 驗證鏈，因為 x402 在 Base 原生支援；Injective 整合留作路線圖。」 |
| Day 1 testnet USDC 找不到 faucet | 用其他 EIP-3009 兼容的 testnet stablecoin，或退到 Base USDC |
| Day 2 結束時 Fusion 引擎還沒跑通 | 砍 judge 階段，panel 結果直接拼接展示，pitch 時說「judge stage 在 V1 補上」 |
| Day 3 結束時 Mastra agent 還沒跑通 | 退回 50 行 TS 純腳本 + OpenAI SDK 呼叫，不用 agent framework |
| Day 4 上午 demo 連續跑 3 次失敗 1 次以上 | 接受「demo 影片裡偶爾要重錄」，繼續錄；下午正常進行 |

---

## 5. 子 Agent Prompt 模板（可直接複製貼進 Claude Code）

### Prompt for Day 1 Stream B（Splitter 合約）

```
你是 0xRecipe 項目的合約工程師。0xRecipe 是 Injective EVM 上的 Fusion 模型市場，
agent 用 x402 付款調用 Fusion 模型，付款需要原子分賬給創作者(80%)和平台(20%)。

請完成：
1. 在 contracts/ 寫一個 FusionPayoutSplitter.sol
   - Solidity 0.8.20+
   - 接收 USDC（ERC-20 假設地址從 constructor 傳入）
   - 一個函式 distribute(address creator)：把當前合約持有的 USDC 餘額按 80/20 分給 creator 和 platform（platform 地址也從 constructor 設定）
   - 一個事件 AuditEvent(address indexed agent, uint256 amount, string reason)，供後端護欄記錄用，提供 emitAudit(...) 函式
   - 安全考量：reentrancy guard、checks-effects-interactions
2. Foundry 測試覆蓋：
   - 分賬精度正確（floor division）
   - 0 餘額時 distribute 不 revert
   - emit AuditEvent 正確
3. 部署 script（但不執行，等 Day 2 主程序員部署）

不要部署。完成後回報合約地址 placeholder 和 ABI。
```

### Prompt for Day 1 Stream C（前端腳手架）

```
你是 0xRecipe 項目的前端工程師。請建立 Next.js 15 + shadcn/ui 專案腳手架：

1. pnpm create next-app@latest forge402-web --typescript --tailwind --app
2. shadcn/ui init + 安裝 Card, Button, Badge, Progress, Toast, Separator
3. wagmi + viem 設定，加 Injective EVM testnet custom chain config（如果 RPC 還沒拿到先用 placeholder）
4. 寫一個 app/page.tsx：三欄 grid 版型
   - 左欄："Agent View"（標題 + 空 card 列表）
   - 中欄："Creator View"（標題 + 空收入卡片）
   - 右欄："On-chain Explorer"（iframe 預留位，先放 about:blank）
5. 預留 SSE client hook（useEventStream），先不接後端，回傳假數據

不要實作付費邏輯、不要接合約。只要版型 + 空殼跑得起來。
```

### Prompt for Day 2 Stream B（Backend Fusion 引擎）

```
你是 0xRecipe 項目的後端工程師。請用 TypeScript + Hono 寫後端：

需求：
- POST /v1/chat/completions，OpenAI 兼容介面
- x402 付款中間件：未付款回 402 + payment requirements（金額 = $0.05 USDC，payTo = FUSION_SPLITTER_ADDRESS env）
- 付款驗證：呼叫 x402 facilitator 的 /verify 和 /settle
- settle 成功後：呼叫 FusionPayoutSplitter.distribute(HARDCODED_CREATOR_ADDR)
- Fusion 引擎：
  - 並行呼叫 GPT-5.5 + Claude-Opus-4.8（用各自的官方 SDK）
  - 拿到兩個答案後，組 judge prompt，再呼叫 GPT-5.5 當 judge
  - judge 必須回傳 JSON：{ consensus, contradictions, partial_coverage, unique_insights, blind_spots, synthesized_answer }
- Hard-coded recipe（寫在 src/recipes.ts）：見 PLAN.md Day 2 Task 2.2
- SSE endpoint GET /events/stream：每次 settle 完成廣播一個事件 { type: 'settlement', agent, creator, amount, tx_hash }
- 預算護欄：內存記一個 Map<agent_addr, spent>，超過 $0.12 → 在 402 階段就拒絕並回 403
- 環境變數：OPENAI_API_KEY, ANTHROPIC_API_KEY, FACILITATOR_URL, FUSION_SPLITTER_ADDRESS, PLATFORM_ADDR, RPC_URL

請寫完並提供本地啟動指令。寫 3 個 curl 範例：(1) 未付款拿 402；(2) 完整付款拿結果；(3) 觸發預算超限。
```

### Prompt for Day 3 Stream A（Mastra Agent）

```
你是 0xRecipe 項目的 Agent 工程師。請用 Mastra 寫一個 LegalReviewerAgent：

1. 初始化 Mastra 專案
2. 定義 agent：
   - name: "Legal Reviewer Agent"
   - instructions: 一段繁體中文 system prompt，告訴 agent 它在審查租約、有 $0.12 預算、能用 reviewContract 工具
   - model: gpt-5.5 或 claude-sonnet-4-6（看哪個快）
3. 工具 reviewContract(contractText: string)：
   - 內部用 fetch 打 POST http://localhost:3001/v1/chat/completions
   - 帶 X-PAYMENT header 處理 402：viem 簽 EIP-3009 TransferWithAuthorization、重試
   - 回傳 Fusion 引擎的結構化 JSON
4. 主程序：給 agent 一份 1500 字假租約（也由你生成），執行 agent.run()
5. 預期：agent 跑 2 次 reviewContract（第二次帶澄清問題），第三次嘗試會被 budget 攔截，agent 在 thought 解釋並結束

回報：完整檔案 + 啟動指令。確認 agent 在 thought log 看得到推理過程。
```

---

## 6. 風險清單（持續追蹤）

| ID | 風險 | 影響 | 緩解 |
|---|---|---|---|
| R1 | Injective EVM testnet USDC 沒 faucet | Day 1 阻塞 | Plan B：切 Base Sepolia |
| R2 | `@injectivelabs/x402` 套件有 undocumented gotcha | Day 1 阻塞 | Plan B：自托管 second-state/x402-facilitator 指 Injective RPC |
| R3 | OpenAI/Anthropic rate limit | Demo 失敗 | 預先 warm up，demo 前一小時跑 5 次熱身 |
| R4 | judge JSON 格式不穩 | Day 2 卡 | judge prompt 加 few-shot example + JSON schema strict mode |
| R5 | Mastra + x402 client 整合不順 | Day 3 卡 | 退回 50 行純 TS 腳本，agent framework 砍 |
| R6 | demo 錄製 iframe 跨域問題 | Day 4 卡 | 用視窗錄製覆蓋整個瀏覽器，不依賴 iframe |
| R7 | OpenAI/Anthropic TOS 轉售風險 | 合規 | MVP demo 接受，pitch 路線圖提 |

---

## 7. V1 路線圖（pitch 帶過、本期不做）

- 創作者發布表單 + 配方注冊表上鏈
- 排行榜 + 評分系統
- 多配方並存 + 配方搜索
- 創作者 stake 機制（防死亡配方）
- ERC-4337 AA 錢包 + 鏈上強制護欄
- 改用 Cosmos `authz` + `feegrant` 原生 AA
- MCP server 讓 Claude Desktop / Cursor 一鍵接入
- 多基礎模型（Gemini、開源模型）
- 預付 escrow 模式 + x402 V2 會話

---

## 8. 開工檢查清單

開工前確認以下事項，缺一不做：

- [ ] 項目名鎖定 **0xRecipe**（或團隊改名後全域 replace）
- [ ] GitHub repo 建好、本文件 push
- [ ] 確認今天是禮拜幾、deadline 禮拜幾
- [ ] Injective EVM testnet RPC + faucet 連結收齊
- [ ] OpenAI + Anthropic API Key 準備好
- [ ] 團隊 3 個 Claude Code 子 agent 視窗開好、Prompt 5 條備好
- [ ] Day 1 早上 10:00 sync、晚上 23:00 spike 結果驗收會議定下

---

**這份文件是承重文件。任何超出範圍的新點子先記在 V1 路線圖、本期不動。**
