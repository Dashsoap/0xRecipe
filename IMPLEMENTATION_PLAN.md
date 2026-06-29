# 0xRecipe — 实施计划(IMPLEMENTATION_PLAN)

> 本文件是 **可执行版**,基于 2026-06-25 的两轮技术尽调(逐条对抗式核验)对 `PLAN.md` 的修正与落地。
> **链路已锁定:Injective EVM testnet,不留其它链兜底**(Injective 黑客松项目)。
> **计费模型已升级:预付 escrow + 按调用扣费**(取代原 per-call exact 结算,见 §1.5)。
> `PLAN.md` 是产品/叙事母文件;**凡与本文件冲突,以本文件为准**。

---

## 0. 已核验的硬事实(Single Source of Truth)

实测/一手来源确认,直接进代码:

### 链与浏览器
- **Injective EVM testnet**:chainId `1439`,CAIP-2 `eip155:1439`
- RPC:**优先 thirdweb `https://1439.rpc.thirdweb.com`**(公共 k8s 节点 `https://k8s.testnet.json-rpc.injective.network/` 有 per-IP 限频,且实测其 `eth_getTransactionReceipt` 不可靠——交易已上块仍返回 not found;PublicNode 备用)
- WS `wss://k8s.testnet.ws.injective.network/`;浏览器 `https://testnet.blockscout.injective.network`
- gas token **INJ**,faucet `https://testnet.faucet.injective.network/`(每地址 24h 一次 → 预充 2-3 个地址)

### 稳定币(token 层零风险)
- **testnet USDC `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d`**,实现 `FiatTokenInjectiveV2_2`,实测带全套 EIP-3009(`transferWithAuthorization` / **`receiveWithAuthorization`** / `cancelAuthorization` / `authorizationState`)
- EIP-712 domain:`name="USDC"`、`version="2"`、`chainId=1439`、`verifyingContract=` 代理地址、`decimals=6`(签名前用 RPC 现场读 `name()`/`DOMAIN_SEPARATOR()` 锁死)
- USDC faucet:`https://faucet.circle.com/`(选 "Injective Testnet")

### Solidity / EVM
- Geth `1.14.11`,**Cancun**;编译器 `0.8.28`,`evm_version=cancun`;Foundry/Hardhat 正常

### x402(三个 scheme,核验后只用其一的变体)
- `exact`:每调用一笔链上结算,EIP-3009 `transferWithAuthorization`(**不解决垫付问题** → 弃用为热路径)
- `upto`:按量(授权上限、结算实际),但用 Permit2、资金留客户端、仍有垫付窗口(V1 可加 token 计量)
- **`batch-settlement`:预付 escrow + 每调一张 off-chain voucher + 批量链上结算 ← 我们采用这个模式**(唯一现成实现是 Cloudflare 链下信用版,**链上 escrow binding 我们自己写**)
- v2 scoped 包 `@x402/*`(~2.16.0);header `PAYMENT-REQUIRED`/`PAYMENT-SIGNATURE`/`PAYMENT-RESPONSE`(**不是** v1 的 `X-PAYMENT`)
- `@injectivelabs/x402` alpha(0.0.1,源码 404):内置 1439 网络配置 + EIP-3009 签名/验签 helper(version "2")→ **复用它的签名原语**,facilitator 角色已大幅缩小(见 §1.5)

### 模型来源 = 统一 OpenAI 兼容网关(已实测),配方 = 模型 × 渠道 × 价格档
- **网关已验证**:base `<OpenAI 兼容网关 base_url,放 .env、不入库>`,一个 `base_url` + 一个 key 调用,后端**不直接接官方 SDK**。实测(2026-06-25):
  - ✅ key 有效;✅ 推理通;✅ **`json_schema` strict 透传**(gpt-5.5 返回严格符合 schema 的 JSON → judge JSON 硬保证);✅ **streaming SSE 透传**(标准 `chat.completion.chunk`)
- **渠道(channel)是一等概念**:同一模型可由多渠道供给、**不同价格/质量**(new-api 式)。已验证两条渠道(同网关、不同 key):
  - `标准渠道`(`LLM_GATEWAY_KEY`):72 模型,gpt/claude/gemini 混合源
  - `官方源渠道`(`LLM_GATEWAY_KEY_PURE`):9 个 claude,官方源(质量高、价更贵)
  - key 在 `~/0xRecipe/.env`(gitignored,**绝不进 repo / 不下发 agent**)
- **配方(recipe)= 任意 N 个 (模型,渠道) 做 panel + 1 个做 judge**,创作者按所选渠道成本自主定价(D6:价 ≥ 2× 上游成本,**按渠道算**)。把「同模型多源不同价」做成配方市场核心卖点。
- **demo 配方**:LegalReviewer ≤3 panel(如 gpt-5.5 标准 + claude-opus-4-8 官方源 + 1 个)+ gpt-5.5 judge;一镜到底控延迟/成本,panel ≤3。
- ⚠️ **用户可见层只说质量档**(如「官方源 / 标准源」),**绝不出现**网关产品名、「纯血/逆向」这类内部词(CLAUDE.md 母规则)。
- ⚠️ 残留待验:judge 若改用 Claude-via-网关,需另测 Claude 的 json_schema 透传(当前 judge=gpt-5.5 已验,不阻塞)。

---

## 1. 对 `PLAN.md` 承重决策的修正

| 编号 | 原决策 | **修正** | 原因 |
|---|---|---|---|
| **C1** | 招牌「原子分账(同一笔 tx)」 | **「原子分账」重新成立**:`escrow.charge()` 里「扣费 + 转 Splitter + distribute」在**同一笔交易原子完成** | escrow 持有普通 ERC-20,内部逻辑可在一笔 tx 内动账+分账;比原 settle→distribute 两笔更强 |
| **C2** | 结算拓扑未定 | **预付 escrow 模型**(见 §1.5):存款 payTo=AgentEscrow;扣费走 `charge()`→Splitter | 见 §1.5 |
| **C3** | 付款顺序问题 | **结构性消除垫付风险**:资金在调用前已锁进链上 escrow;solvency check 读的是**已锁余额**,失败不扣费 | 用户指出「成功才结算我垫付不可回收成本」——预付 escrow 让平台永不垫付 |
| **C4** | 后端只列 RPC | 后端热钱包 `BACKEND_PRIVATE_KEY`:充 INJ,兼 **deposit relayer + `charge()` 签名者(onlyBackend)** | 链上调用都后端付费 |
| **C5** | facilitator「找现成」 | **facilitator 角色缩小**:仅一次性存款 relay(后端调 `escrow.depositFor`),**热路径无 facilitator** | Injective 无公开 facilitator;escrow 模型把它移出热路径 |
| **C6** | judge JSON 字段两套 | Day 2 早上定一个共享 TS 类型 `FusionResult` | 防 schema 漂移 |
| **C7** | x402 client 写两遍 | Day 1 封可复用模块(含 EIP-3009 签名 + voucher 签名) | 防集成日重推导 |
| **C8** | testnet USDC 当"最大未知数" | **已关闭**(USDC+EIP-3009+faucet 全验证) | §0 |
| **C9(新)** | 计费=per-call exact | **预付 escrow + 固定单价/调用(token 计量延到 V1)** | 用户方向:预付+按量;4 天 MVP 先固定单价 |
| **C10(新)** | — | **每次调用带 off-chain 签名 voucher**(EIP-712),后端验签恢复地址再扣费 | 仅凭地址扣费可被冒充;voucher 防冒充,省的是链上结算不是签名 |
| **C11(新)** | — | **存款用 `escrow.depositFor` + `receiveWithAuthorization`**,记账到签名者 `from` | `transferWithAuthorization` 打合约会到账但不记账(锁死坑);Day 1 必须专门测「receiveWithAuthorization→合约」 |

---

## 1.5 计费架构:预付 escrow + 每调一张 voucher(x402 batch-settlement 模式)

**核心**:钱包即账户(免注册);agent 一次性把 USDC 存进链上 escrow;每次调用带一张签名凭证;后端扣的是 escrow 里**已锁定的钱**,所以**平台永不垫付不可回收的上游成本**,失败不扣费。

> 注意分两层:**下游(链上)= agent 付 0xRecipe**(本节);**上游(链下)= 0xRecipe 付模型** 走统一 OpenAI 兼容网关(见 §0)。escrow 余额是 agent 的预付款;网关 quota 是平台的上游成本。两者独立。

### 合约
- **`AgentEscrow.sol`(新,~120-150 行)**
  - `depositFor(address from, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes sig)`:内部调 `usdc.receiveWithAuthorization(from, address(this), value, ...)`(此时合约自身是 `msg.sender==payee`,过检查),成功后 `balances[from] += value`(**记到签名者 from,不是 relayer**),emit Deposited。后端 relayer 提交,对 agent gasless。
  - `charge(address agent, uint256 amount, address creator)` **onlyBackend**:CEI — `require(balances[agent] >= amount)`;`balances[agent] -= amount`;`usdc.transfer(splitter, amount)`;`splitter.distribute(creator)`;emit Charged + AuditEvent。**一笔原子 tx**,后端付 INJ gas。
  - `withdraw(uint256 amount)`:`balances[msg.sender] -= amount`;转回 agent。随时取回未花余额。
  - `balanceOf(address) view`;ReentrancyGuard + CEI;onlyBackend = 部署时授权的后端热钱包。
- **`FusionPayoutSplitter.sol`**:`distribute(creator)` 读自身余额按 20/80 拆(creator `200000` / platform `800000` over `1e6`,即 `CREATOR_BPS=200000`、`platformCut = bal - creatorCut` 自动为 80%,floor,0 余额不 revert,ReentrancyGuard),由 `AgentEscrow.charge()` 调用。**分账在 gross(agent 付的全价)上拆:创作者 20% 返佣、不承担成本;平台 80%,从这 80% 里垫付上游算力/API 成本。链上不放成本,只按 gross 拆 20/80。**

### 每次调用的凭证(voucher,热路径)
- agent 签 EIP-712 voucher `{agent, recipeId, maxPrice, nonce, expiry}`,放进 `PAYMENT-SIGNATURE` header。
- 后端:验签恢复签名者(= 证明它控制该钱包,防冒充)→ 查 `escrow.balanceOf(agent) - 内存hold >= price`(否则 403)→ 内存 hold → 跑 Fusion → 成功才 `escrow.charge()` → 释放 hold。
- **热路径无链上结算、无 facilitator 往返**;存款是唯一的链上付款授权。
- MVP 捷径(仅限脚本化单 agent demo):可暂时只凭地址+余额扣费,但**必须标注「可被冒充,正式版用 voucher」**;voucher 才是诚实/安全的设计。

### 付款时序(取代原 §3)
```
0. 存款(一次):agent 签 EIP-3009 ReceiveWithAuthorization(to=AgentEscrow,额度=N 次调用)
   → 后端 relayer 调 escrow.depositFor(签名参数) → balances[agent] += value
   → 钱包即账户,无 key、无注册
1. 调用:POST /v1/chat/completions,header 带签名 voucher(无每调链上结算)
2. 鉴权+偿付检查:验 voucher 签名恢复 agent;读链上 balanceOf(agent) - hold >= price?
   否 → 403(client 必须区分 403≠402:不重签,把"余额/预算不足"上抛给 agent 推理 ← demo 高潮)
3. hold:内存记 price(防 withdraw 竞态,~几秒窗口;脚本 demo 无并发可省)
4. 跑 Fusion:并行 gpt-5.5 + claude-sonnet-4-6 → gpt-5.5 judge(strict json)
   ← 真金白银花在这,但 step 2 已确认链上锁定余额存在
5a. 失败:释放 hold,不调 charge();agent 保留 100% 余额;系统级错误气泡(A.4 绝不伪造 LLM 输出)
5b. 成功:escrow.charge(agent, price, creator) — 一笔原子 tx:扣费 + 20/80 链上强制分账(creator 20% / platform 80%)
6. 返回:释放 hold;SSE 广播 settlement(agent/creator/amount/tx hash);返回 FusionResult + tx hash
7. 取回(随时):escrow.withdraw(amount) 拿回未花余额
```

### 关键澄清(诚实定位,防被评委戳穿)
- **这把 x402 移出了"每调一笔链上结算"**:热路径是 off-chain voucher + 延迟到 escrow 的批量结算 —— 这正是 x402 **batch-settlement / capital-backed escrow** 模式(是 x402 的正式 scheme,不是脱离 x402)。存款仍是一次真实的 EIP-3009 gasless 授权。pitch 话术统一为「预存一次 + 按调用扣费 + 链上强制分账」,**不要**说「每次调用一笔链上 x402 结算」。
- **20/80 分账时点**:demo 用**每调用即分**(`charge()` 内一笔原子完成,创作者 20% 返佣 toast 每调一跳,视觉最好);高频场景的批量分账(在 withdraw/结算时一次拆,省 gas)留 V1。
- **「预算墙」demo**:存刚好够 2 次的额度 → 第 3 次 `balanceOf < price` → 403。**escrow 余额即预算**(可省掉原 D14 的内存 budget Map;要策略上限再叠一个)。
- **托管信任**:escrow 在 deposit~withdraw 间托管 agent 资金,`onlyBackend` key 泄漏的影响面 = 总托管额。缓解:每笔 `Charged` 事件链上可审计、固定单价、V1 把 voucher 上链(charge 校验 voucher 签名)做信任最小化。

---

## 2. 阶段拆解(4 天,每天有 demo-able 增量)

> 把端到端联调从 Day 3 提前到 Day 2(curl 跑通 deposit→charge→SSE,不带 agent)。escrow 模型**降低**了热路径风险(无每调签名/结算),净改动是小增量不是重写。

### Stage 1 — Day 1:Spike(含 receiveWithAuthorization)+ 合约 + 脚手架
**Goal**:看到 Injective 浏览器上 ① 一笔 USDC 经 `receiveWithAuthorization` **存入合约**并正确记账,② `withdraw` 取回。
**Success Criteria**:
- [ ] 环境:`eth_chainId`=`0x59f`(1439);buyer 有 testnet USDC,relayer 有 INJ
- [ ] **关键 spike:`receiveWithAuthorization` → 合约**(不是 `transferWithAuthorization`→EOA)。证明 `escrow.depositFor` 能记账到签名者 `from`;`transferWithAuthorization` 打合约会到账但不记账(验证这个坑确实存在,确认不踩)
- [ ] 现场读 testnet USDC `name()`/`DOMAIN_SEPARATOR()` 锁 EIP-712 domain
- [ ] x402/EIP-3009 client 封可复用模块(C7):EIP-3009 授权签名 + voucher 签名
- [ ] `gpt-5.5`/`claude-sonnet-4-6` 各发一次真实调用确认 200 + 有权限
- [ ] 截图存档(pitch 用)

**Stream A(人类)**:环境 + `depositFor`/`receiveWithAuthorization` spike + deposit/withdraw 跑通
**Stream B(子 agent)**:`AgentEscrow.sol` + `FusionPayoutSplitter.sol`(Solidity 0.8.28,evm cancun)
- AgentEscrow:`depositFor` / `charge`(onlyBackend) / `withdraw` / `balanceOf`,接口见 §1.5;ReentrancyGuard + CEI
- Splitter:`distribute(creator)` 20/80(creator `CREATOR_BPS=200000` / platform `800000` over `1e6`);`AuditEvent` + `emitAudit`
- Foundry 测试:存款记账到 from、charge 扣费+分账精度、0 余额不 revert、withdraw、重入防护、onlyBackend 鉴权
- **Day 1 不部署**(spike 确认后 Day 2 部署)
**Stream C(子 agent)**:Next.js 15 + shadcn + wagmi/viem(custom chain 1439);三栏空版型 + `useEventStream`(假数据)

### Stage 2 — Day 2:部署 + Fusion 引擎 + **curl 端到端** + 前端
**Goal**:`curl` 跑通:deposit 一次 → 带 voucher 调用 → solvency check → 跑 Fusion → `charge()` 原子扣费+20/80 → 返回 `FusionResult`+tx hash;前端三栏 + SSE 通。
**Success Criteria**:
- [ ] AgentEscrow + Splitter 部署到 1439,地址进 `.env`;手动测:deposit $0.10 → `charge($0.05, creator)` → creator $0.01(20%) / platform $0.04(80%) / escrow 余 $0.05
- [ ] **共享类型 `FusionResult` 定稿**(C6),三方 import
- [ ] 后端按 §1.5 时序:验 voucher → solvency(读链上余额)→ Fusion → 成功才 `charge()`;失败诚实错误态(A.4)
- [ ] **预算墙 = escrow 余额**:deposit 只够 2 次,第 3 次 `balanceOf < price` → 403
- [ ] **1500 字假租约 + 故意埋矛盾条款**,跑 5 次确认 panel+judge 稳定标出 `contradictions` → 冻结为夹具
- [ ] **成本核算(D6)**:按**网关 quota 计费**实算一次调用(N panel + judge)的上游成本;模型越多成本越高 → 每个配方按 lineup 定价,demo 价若 < 2× 上游成本则抬价
- [ ] 前端三栏 + SSE 实时更新(预算条随 `balanceOf` 下降、创作者收入 toast)

**Fusion 流程**:并行调用配方指定的 N 个 panel 模型(全经统一网关,OpenAI 兼容)→ 组 judge prompt → judge(默认 gpt-5.5)输出 `FusionResult = { consensus, contradictions, partial_coverage, unique_insights, blind_spots, synthesized_answer }`。
**判官 JSON**:优先 `response_format: json_schema` + `strict:true`(网关透传时);Day 2 实测若网关不透传 → 稳健解析 + 一次重试兜底。

### Stage 3 — Day 3:Mastra Agent(叠加在已通管线上)
**Goal**:agent 完整多步 loop;三栏实时更新;第 3 次撞预算墙(余额不足)且优雅处理。
**Success Criteria**:
- [ ] `LegalReviewerAgent`(Mastra):**启动时 deposit 一次**(够 2 次调用),工具 `reviewContract` 每调带 voucher(用 Day 1 模块),无每调链上结算
- [ ] **15:00 硬检查点**:Mastra+x402 不顺 → 切 R5 兜底(~50 行纯 TS + viem 签名脚本)
- [ ] 多步:读合同 → `reviewContract` 拿含 `contradictions` 的 JSON → 追问某条款 → 再调 → 第 3 次余额不足
- [ ] **403 语义打通**:余额不足后端返 403;client 识别 403(不重签)上抛给 agent 推理 ← demo 高潮
- [ ] 四服务端到端;三栏实时;浏览器 iframe 跳转正确

### Stage 4 — Day 4:录制 + Pitch + README
**Success Criteria**:
- [ ] demo 连跑 3 次全成功;UI polish;全程录制机 localhost(iframe/SSE 提前 Day 2 验过)
- [ ] 3 分钟一镜到底;0:20-0:50 改「展示 hard-coded recipe + 未来开放上架」
- [ ] Pitch 10 页:第 7 页用 Day 2 实算成本 + gross 20/80 拆账叙事(平台主导运营、从 80% 里垫付上游算力/API 成本;创作者 20% 返佣、不担成本;平台净利 = 80%×价 − API 成本);架构图/话术统一「预存一次 + 按调用扣费 + **链上强制原子分账(creator 20% / platform 80%)**」,**不说**「每调一笔链上结算」
- [ ] README:定位 + demo 链接 + local quickstart + limitations + V1 路线图(token 计量 / voucher 上链 / 多配方)

---

## 3. 环境变量清单(后端)

```
RPC_URL                 = https://1439.rpc.thirdweb.com   # thirdweb 为主:k8s 公共节点 receipt 不可靠
CHAIN_ID                = 1439
USDC_ADDRESS            = 0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d
AGENT_ESCROW_ADDRESS    = <部署脚本自动写入;见 contracts/deployments/injective-testnet-1439.json>
FUSION_SPLITTER_ADDRESS = <部署脚本自动写入;同上>
PLATFORM_ADDR           = <平台收款地址>
HARDCODED_CREATOR_ADDR  = <创作者测试钱包>
BACKEND_PRIVATE_KEY     = <后端热钱包:充 INJ;deposit relayer + charge() onlyBackend 签名>  # 现用 MNEMONIC 派生 index0 代替
LLM_GATEWAY_URL         = <OpenAI 兼容网关 base_url>   # 放 .env、不入库;已实测透传 json_schema/SSE
LLM_GATEWAY_KEY         = <标准渠道 key,72 模型;在 .env,绝不进 repo / 不下发 agent>
LLM_GATEWAY_KEY_PURE    = <官方源 Claude 渠道 key,9 个 claude 官方源;在 .env>
RECIPE_PRICE_USDC       = <Day 2 按 D6 实算后定>
VOUCHER_DOMAIN          = <EIP-712 domain for per-call voucher>
```
> 注:热路径不再需要 `X402_FACILITATOR_URL`;存款由后端 relayer 直接调 `escrow.depositFor`。

---

## 4. 开工检查清单(Day 1 早上)

- [ ] `git status` 干净;本文件已 push
- [ ] Circle faucet 领 testnet USDC;Injective faucet 给 2-3 地址充 INJ
- [ ] `gpt-5.5`/`claude-sonnet-4-6` 各发一次真实调用确认 200
- [ ] `eth_chainId` 确认 1439;现场读 USDC `name()`/`DOMAIN_SEPARATOR()`
- [ ] 3 个子 agent 窗口开好

---

## 5. 风险清单(更新)

| ID | 风险 | 影响 | 缓解 |
|---|---|---|---|
| **R1** | `receiveWithAuthorization` → 合约存款记账是唯一未验证原语 | ✅ **已关闭** | 已链上验证(testnet 1439):agent 签 EIP-3009 → 后端 relay `depositFor` 记账到签名者 → `charge` 扣费 + 20/80 分账全通过(`backend/scripts/spike-deposit-charge.mjs`) |
| **R2** | `@injectivelabs/x402` alpha(0.0.1,源码 404) | 集成不确定 | pin 死版本,只取其 EIP-3009 签名原语;读 node_modules 确认 API |
| **R3** | escrow 托管 agent 资金,`onlyBackend` key 泄漏影响面=总托管额 | 安全 | 每笔 Charged 事件可审计;固定单价;V1 voucher 上链 |
| **R4** | 仅凭地址扣费可被冒充 | 安全 | C10:每调 voucher 验签;脚本 demo 走捷径要标注 |
| **R5** | Day 3 超载 | 进度 | 联调提前 Day 2;15:00 切纯 TS 兜底 |
| **R6** | 判官 JSON 不稳 / 网关不透传 json_schema | Day 2 卡 | 经网关实测 strict json_schema 透传;不透传则稳健解析+重试 |
| **R7** | demo 矛盾条款不稳定触发 | 叙事塌 | Day 2 埋矛盾 + 跑 5 次冻结夹具 |
| **R8** | $0.05 违反 D6 | 商业 slide | Day 2 实算抬价 + prompt caching |
| **R9** | OpenAI/Anthropic 转售 TOS | 合规 | MVP 接受,pitch 路线图提 |
| **R10** | 公共 RPC 限频 | 部署慢 | 备 thirdweb/PublicNode dev RPC |
| **R11** | "x402 移出每调链上结算"被评委质疑不算 x402 | 叙事 | 明确定位为 x402 batch-settlement(capital-backed escrow)模式 + 存款是真 EIP-3009 |
| **R12** | 上游统一网关:json_schema/streaming 透传、限频、稳定性、转售 TOS(叠加 R9) | Fusion 卡/合规 | Day 1 经网关验透传;网关挂=Fusion 停 → demo 前热身;UI/pitch 不提网关产品名 |

> 工程稳健:链参数收敛到一个 config 模块。**demo / pitch / README 100% Injective,不提其它链。**

---

**本文件随进度更新 `Status`。**
```
状态:Stage 1 ✅ 完成(合约+测试+脚手架,forge test 8/8) / Stage 2 ✅ 完成(20/80 合约部署 testnet 1439 + R1 链上验证;后端接真网关跑通;**curl 端到端 5/5 链上验证**:voucher→solvency→Fusion→charge 原子 20/80→SSE;矛盾夹具 1500 字/6 矛盾,5/5 稳定检出已冻结;成本核算 D6 实测网关真账 ~$0.39/次 → 定价 $1.00=2.6×;前端三栏接真 SSE,typecheck+build 绿) / Stage 3 ✅ 完成(自治 agent 链上联调通过:预付一次→每调签 voucher→多步评审→第 3 次撞 403 预算墙 LLM 推理停;gateway 跨渠道 system-400 自愈;前端补 CORS 后浏览器可连)/ Stage 4 未开始

> Stage 2 验证产物:`backend/scripts/e2e-http.ts`(端到端 5/5)、`backend/scripts/measure-cost.ts`(成本核算)、`backend/test/fixtures/lease.ts`(矛盾夹具)。Stage 3:`backend/scripts/legal-reviewer-agent.ts`(自治 agent)、`backend/scripts/setup-budget-wall.ts`(预算墙布置)。
```
