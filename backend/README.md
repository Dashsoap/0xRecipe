# @0xrecipe/backend

Fusion engine + prepaid-escrow billing for 0xRecipe, on Injective EVM testnet.

An agent prepays USDC into an on-chain escrow once, then calls the Fusion
endpoint with a signed per-call voucher. The backend verifies the voucher,
checks the agent's on-chain balance, runs the recipe (a panel of models plus a
judge through one OpenAI-compatible gateway), and — only on success — charges
the escrow in a single atomic transaction that also splits the payout 20/80 to
the recipe creator and the platform.

## Quickstart

```bash
# from the repo root (workspace install is run centrally)
pnpm --filter @0xrecipe/backend dev
```

Scripts (run from `backend/`):

| script | what it does |
| --- | --- |
| `pnpm dev` | watch + run `src/index.ts` (tsx) |
| `pnpm build` | compile to `dist/` |
| `pnpm start` | run the built `dist/index.js` |
| `pnpm typecheck` | type-check without emitting |

Default port is `3001` (override with `PORT`).

## Configuration

Copy `.env.example` to the repo-root `.env` (gitignored) and fill it in. No
secret is ever bundled in source — every key and address is read from the
environment, and the service fails fast with a clear message if a required one
is missing. See `.env.example` for the full list with neutral placeholders.

Two model sources are configured by separate keys:

- **standard source** — `LLM_GATEWAY_KEY`
- **official source** — `LLM_GATEWAY_KEY_PURE`

Both go through one OpenAI-compatible `base_url` (`LLM_GATEWAY_URL`); the backend
does not integrate any vendor SDK directly.

## Endpoints

### `POST /v1/chat/completions`

The paid Fusion endpoint. The request carries the signed voucher in the
`PAYMENT-SIGNATURE` header as JSON:

```json
{
  "voucher": {
    "agent": "0x…",
    "recipeId": "legal-reviewer-v1",
    "maxPrice": "50000",
    "nonce": "1",
    "expiry": "1750000000"
  },
  "signature": "0x…"
}
```

`maxPrice`, `nonce`, and `expiry` are integer strings (USDC smallest units /
unix seconds). The body is OpenAI-shaped: `{ "messages": [{ "role": "user",
"content": "…" }] }`.

Flow: verify voucher signer == agent -> check on-chain escrow balance minus
in-flight holds -> hold -> run Fusion -> charge on success -> release ->
return the structured result plus `txHash`. On a successful settlement, a
`settlement` event is broadcast to `/events/stream`.

**402 vs 403.** A missing or invalid voucher is `401`/`403` (auth). An
**insufficient escrow balance returns `403`, not `402`** — the client must
distinguish them: a `403` means "balance/budget too low", so it should **not**
re-sign and retry; it should surface the shortfall to the agent's reasoning.

Response body on success is `FusionResult & { txHash }`:

```json
{
  "consensus": "…",
  "contradictions": ["…"],
  "partial_coverage": ["…"],
  "unique_insights": ["…"],
  "blind_spots": ["…"],
  "synthesized_answer": "…",
  "txHash": "0x…"
}
```

### `GET /events/stream`

Server-Sent Events. Emits a `settlement` event after each successful charge
(`{ agent, creator, amount, txHash, recipeId, ts }`) and a periodic `ping`.

### `GET /health`

Liveness plus which dependencies are configured (escrow / splitter / backend
wallet / standard source / official source).

## Current status

The backend hot path is implemented: voucher verification, expiry checks,
SQLite-backed nonce replay protection, on-chain solvency checks, in-flight
holds, Fusion execution, atomic escrow charging, SSE broadcast, and the local
usage ledger.

External dependencies are still required for a live run. Where a dependency is
unconfigured, the endpoint fails fast with a clear error and **never returns
fabricated data**.

- **On-chain reads/writes** (`src/escrow.ts`): require `AGENT_ESCROW_ADDRESS`
  and either `BACKEND_PRIVATE_KEY` or `MNEMONIC`. The backend signer must match
  the deployed escrow's `onlyBackend` address and be funded with INJ gas.
- **Model calls** (`src/gateway.ts`, `src/fusion.ts`): require
  `LLM_GATEWAY_URL` plus the source key(s) used by the recipe. The seeded recipe
  uses both `LLM_GATEWAY_KEY` and `LLM_GATEWAY_KEY_PURE`.
- **Pricing and recipe data**: the seeded recipe defaults to `1.00` USDC unless
  `RECIPE_PRICE_USDC` is set before the first DB boot. After that, runtime price
  lives in SQLite and can be inspected/changed via `scripts/recipe-admin.mjs`
  (`list`, `show`, `set-price`, `set-creator`).
- **Live e2e scripts**: `scripts/e2e-http.ts` and
  `scripts/legal-reviewer-agent.ts` expect a repo-root `.env` loaded with
  `node --env-file=../.env` from the backend directory.

## Mock mode

For local demos without the deployed backend EOA, funded wallets, or model keys,
set:

```bash
MOCK_CHAIN=1
MOCK_FUSION=1
MOCK_AGENT_BALANCE_USDC=10.00
```

`MOCK_CHAIN=1` replaces escrow reads/writes with a fixed mock balance and
synthetic tx hashes. `MOCK_FUSION=1` returns a deterministic Fusion fixture
instead of calling the model gateway. The paid HTTP route still verifies the
signed voucher, enforces nonce replay protection, emits SSE settlements, and
writes the ledger, so it is useful for UI and agent-loop rehearsal. `/health`
reports which mock switches are active.

## Operator scripts

From the repo root:

```bash
pnpm doctor
pnpm e2e:dry-run
pnpm gateway:smoke
```

- `doctor` checks public env state, deployed contract code, escrow wiring,
  backend signer, recipe price/creator, and the demo agent escrow balance.
- `e2e:dry-run` intentionally disables model keys and proves a Fusion failure
  returns `502 fusion_failed` without charging escrow or emitting settlement.
- `gateway:smoke` checks the standard and official OpenAI-compatible gateway
  keys before running a full e2e.

Recipe maintenance:

```bash
node --env-file=.env backend/scripts/recipe-admin.mjs list
node --env-file=.env backend/scripts/recipe-admin.mjs show legal-reviewer-v1
node --env-file=.env backend/scripts/recipe-admin.mjs reset-demo 0.05
```
