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

## Skeleton status (to be wired during integration)

This package is the route + type skeleton. The structure and types are
complete, but the following depend on external pieces that land during
integration. Where a dependency is unconfigured, the endpoint fails fast with a
clear "not configured" error and **never returns fabricated data**.

- **On-chain reads/writes** (`src/escrow.ts`): need a deployed
  `AGENT_ESCROW_ADDRESS` and a funded `BACKEND_PRIVATE_KEY`. Until then,
  solvency checks return `503` and charges error honestly. The ABI is a minimal
  fragment matching the contract interface; align it with the deployed
  contract.
- **Model calls** (`src/gateway.ts`, `src/fusion.ts`): need the gateway URL and
  at least the source key(s) the recipe uses. The judge requests strict
  `json_schema`; if a gateway does not forward it, the engine retries once with
  a hardened prompt and otherwise throws (no fabricated result).
- **Voucher nonce replay protection**: the voucher signature and expiry are
  checked; per-agent nonce tracking is left for integration.
- **Pricing** (`RECIPE_PRICE_USDC`): defaults to a demo price; set after the
  cost analysis.
