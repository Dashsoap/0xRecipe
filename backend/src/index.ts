/**
 * 0xRecipe backend HTTP surface (Hono).
 *
 * Routes:
 *   - POST /v1/chat/completions : the paid Fusion endpoint (voucher -> solvency
 *     -> hold -> Fusion -> charge -> release -> result + tx hash).
 *   - GET  /events/stream       : SSE stream of settlement events.
 *   - GET  /health              : liveness + which dependencies are configured.
 *
 * Skeleton stage: the route structure and types are complete. Where on-chain or
 * gateway dependencies are not configured, the endpoint fails fast with a clear
 * "not configured" error — it never returns fabricated data.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { formatUnits, getAddress, type Address, type Hex } from "viem";
import {
  verifyVoucher,
  injectiveTestnet,
  CHAIN_ID,
  USDC_DOMAIN_NAME,
  USDC_DOMAIN_VERSION,
  RECEIVE_WITH_AUTHORIZATION_TYPES,
  type PaymentVoucher,
} from "@0xrecipe/x402";
import type { FusionResult, SettlementEvent } from "@0xrecipe/shared";
import { config } from "./config.js";
import { getRecipe } from "./recipes.js";
import { runFusion } from "./fusion.js";
import { reserve, release } from "./solvency.js";
import { charge, readBalance, relayDeposit } from "./escrow.js";
import { insertLedgerEntry, listLedgerByAgent } from "./db.js";
import { claimNonce, settleNonce, releaseNonce } from "./nonces.js";

const app = new Hono();

// --- SSE broadcast hub -------------------------------------------------------

type SettlementListener = (event: SettlementEvent) => void;
const listeners = new Set<SettlementListener>();

/** Broadcast a settlement event to every connected SSE client. */
function broadcast(event: SettlementEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

// --- Voucher header parsing --------------------------------------------------

/**
 * Wire envelope for the `PAYMENT-SIGNATURE` header: a JSON object carrying the
 * voucher (bigint fields as decimal strings) and its signature. Kept narrow so
 * a malformed header is rejected rather than coerced.
 */
interface VoucherEnvelopeWire {
  voucher: {
    agent: string;
    recipeId: string;
    maxPrice: string;
    nonce: string;
    expiry: string;
  };
  signature: string;
}

interface ParsedVoucher {
  voucher: PaymentVoucher;
  signature: Hex;
}

class VoucherError extends Error {}

/** Parse + shape-check the PAYMENT-SIGNATURE header into a typed voucher. */
function parseVoucherHeader(header: string | undefined): ParsedVoucher {
  if (!header) {
    throw new VoucherError("Missing PAYMENT-SIGNATURE header.");
  }

  let parsed: VoucherEnvelopeWire;
  try {
    parsed = JSON.parse(header) as VoucherEnvelopeWire;
  } catch {
    throw new VoucherError("PAYMENT-SIGNATURE header is not valid JSON.");
  }

  const v = parsed.voucher;
  if (!v || typeof parsed.signature !== "string") {
    throw new VoucherError("PAYMENT-SIGNATURE missing voucher or signature.");
  }

  let agent: Address;
  try {
    agent = getAddress(v.agent);
  } catch {
    throw new VoucherError("Voucher agent is not a valid address.");
  }

  let maxPrice: bigint;
  let nonce: bigint;
  let expiry: bigint;
  try {
    maxPrice = BigInt(v.maxPrice);
    nonce = BigInt(v.nonce);
    expiry = BigInt(v.expiry);
  } catch {
    throw new VoucherError("Voucher numeric fields must be integer strings.");
  }

  if (maxPrice < 0n || nonce < 0n || expiry < 0n) {
    throw new VoucherError("Voucher numeric fields must be non-negative.");
  }

  if (typeof v.recipeId !== "string" || v.recipeId.length === 0) {
    throw new VoucherError("Voucher recipeId is required.");
  }

  return {
    voucher: { agent, recipeId: v.recipeId, maxPrice, nonce, expiry },
    signature: parsed.signature as Hex,
  };
}

// --- Routes ------------------------------------------------------------------

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    chainId: config.chainId,
    configured: {
      escrow: Boolean(config.agentEscrowAddress),
      splitter: Boolean(config.fusionSplitterAddress),
      backendWallet: Boolean(config.backendPrivateKey),
      standardSource: Boolean(config.llmGatewayKey),
      officialSource: Boolean(config.llmGatewayKeyPure),
    },
  });
});

// --- Agent self-serve endpoints (balance / usage / deposit) ------------------
//
// These let an AI agent operate the prepaid escrow on its own: check its
// balance, read its bill/usage log, and prefund — with no human and no external
// system in the loop. Honest errors only: 400 bad input, 503 chain/config not
// ready, 502 relay failure. We never fabricate a balance, tx hash, or entry.

/**
 * Read an agent's prepaid escrow balance. No auth: a balance is public on-chain
 * data keyed by address, and the agent needs it to decide whether to prefund.
 */
app.get("/v1/balance/:agent", async (c) => {
  let agent: Address;
  try {
    agent = getAddress(c.req.param("agent"));
  } catch {
    return c.json(
      {
        error: "invalid_agent",
        message: "The agent path segment is not a valid address.",
      },
      400,
    );
  }

  try {
    const balance = await readBalance(agent);
    return c.json({
      agent,
      balanceUnits: balance.toString(),
      balanceUsdc: formatUnits(balance, 6),
    });
  } catch (err) {
    // Read failed, or chain/escrow config is not ready. Honest 503 with a generic
    // message; the real cause is logged server-side, never returned, and we never
    // hand back a fabricated balance.
    console.error("[balance] escrow balance read failed:", err);
    return c.json(
      {
        error: "balance_unavailable",
        message:
          "The balance service is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
});

/**
 * An agent's own bill / usage log: every confirmed deposit and settled charge,
 * newest first. Reads the local ledger only (no chain), so it always responds.
 */
app.get("/v1/usage/:agent", (c) => {
  let agent: Address;
  try {
    agent = getAddress(c.req.param("agent"));
  } catch {
    return c.json(
      {
        error: "invalid_agent",
        message: "The agent path segment is not a valid address.",
      },
      400,
    );
  }
  return c.json({ agent, entries: listLedgerByAgent(agent.toLowerCase(), 100) });
});

/**
 * Everything an agent needs to sign an EIP-3009 ReceiveWithAuthorization that
 * prefunds the escrow. The agent signs with to=escrowAddress and POSTs the
 * result to /v1/deposit. 503 until the escrow address is configured — we never
 * hand back a placeholder contract address.
 */
app.get("/v1/deposit/info", (c) => {
  const escrowAddress = config.agentEscrowAddress;
  if (!escrowAddress) {
    return c.json(
      {
        error: "deposit_unavailable",
        message: "Deposits are not available right now. Please try again later.",
      },
      503,
    );
  }
  return c.json({
    chainId: CHAIN_ID,
    escrowAddress,
    usdcAddress: config.usdcAddress,
    domain: {
      name: USDC_DOMAIN_NAME,
      version: USDC_DOMAIN_VERSION,
      chainId: CHAIN_ID,
      verifyingContract: config.usdcAddress,
    },
    primaryType: "ReceiveWithAuthorization",
    types: RECEIVE_WITH_AUTHORIZATION_TYPES,
    note:
      "Sign this ReceiveWithAuthorization with to=escrowAddress, then POST it to /v1/deposit.",
  });
});

/** Wire body for POST /v1/deposit (bigint fields as decimal strings). */
interface DepositBodyWire {
  from?: unknown;
  value?: unknown;
  validAfter?: unknown;
  validBefore?: unknown;
  nonce?: unknown;
  v?: unknown;
  r?: unknown;
  s?: unknown;
}

const HEX_RE = /^0x[0-9a-fA-F]+$/;
const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;

/**
 * A missing-config error (from requireEnv) is operational — the escrow address
 * or backend key is not set — so it maps to 503, not the agent's 502.
 */
function isMissingConfigError(err: unknown): boolean {
  return (
    err instanceof Error &&
    err.message.includes("Missing required environment variable")
  );
}

/**
 * Relay an agent's signed EIP-3009 prefund into escrow (the agent pays no gas).
 * relayDeposit awaits the on-chain receipt, so a 200 here means the deposit is
 * confirmed; we then record it in the ledger and return the new balance.
 */
app.post("/v1/deposit", async (c) => {
  // 1. Parse + strictly validate the body. Any malformed field is the agent's
  //    error (400) and is never coerced.
  let parsedBody: unknown;
  try {
    parsedBody = await c.req.json();
  } catch {
    return c.json(
      { error: "invalid_deposit", message: "Request body must be a JSON object." },
      400,
    );
  }
  // A valid JSON `null` (or an array / primitive) parses without throwing; reject
  // it explicitly so a non-object body gets an accurate 400 instead of falling
  // through to a misleading field-level error on a null property access.
  if (
    parsedBody === null ||
    typeof parsedBody !== "object" ||
    Array.isArray(parsedBody)
  ) {
    return c.json(
      { error: "invalid_deposit", message: "Request body must be a JSON object." },
      400,
    );
  }
  const body = parsedBody as DepositBodyWire;

  let from: Address;
  try {
    from = getAddress(body.from as string);
  } catch {
    return c.json(
      { error: "invalid_deposit", message: "Field 'from' is not a valid address." },
      400,
    );
  }

  if (typeof body.nonce !== "string" || !BYTES32_RE.test(body.nonce)) {
    return c.json(
      {
        error: "invalid_deposit",
        message: "Field 'nonce' must be a 32-byte 0x-hex string.",
      },
      400,
    );
  }
  if (typeof body.r !== "string" || !HEX_RE.test(body.r)) {
    return c.json(
      { error: "invalid_deposit", message: "Field 'r' must be a 0x-hex string." },
      400,
    );
  }
  if (typeof body.s !== "string" || !HEX_RE.test(body.s)) {
    return c.json(
      { error: "invalid_deposit", message: "Field 's' must be a 0x-hex string." },
      400,
    );
  }
  if (typeof body.v !== "number" || !Number.isInteger(body.v)) {
    return c.json(
      { error: "invalid_deposit", message: "Field 'v' must be an integer." },
      400,
    );
  }
  if (
    typeof body.value !== "string" ||
    typeof body.validAfter !== "string" ||
    typeof body.validBefore !== "string"
  ) {
    return c.json(
      {
        error: "invalid_deposit",
        message:
          "Fields 'value', 'validAfter', 'validBefore' must be decimal integer strings.",
      },
      400,
    );
  }

  let value: bigint;
  let validAfter: bigint;
  let validBefore: bigint;
  try {
    value = BigInt(body.value);
    validAfter = BigInt(body.validAfter);
    validBefore = BigInt(body.validBefore);
  } catch {
    return c.json(
      {
        error: "invalid_deposit",
        message:
          "Fields 'value', 'validAfter', 'validBefore' must be decimal integer strings.",
      },
      400,
    );
  }
  if (value < 0n || validAfter < 0n || validBefore < 0n) {
    return c.json(
      { error: "invalid_deposit", message: "Numeric fields must be non-negative." },
      400,
    );
  }

  // 2. Relay on-chain. relayDeposit awaits the receipt, so a resolved call means
  //    the deposit is confirmed. Missing escrow/key config -> 503; any other
  //    relay/chain failure -> 502. The real cause is logged, never returned.
  let txHash: Hex;
  try {
    txHash = await relayDeposit({
      from,
      value,
      validAfter,
      validBefore,
      nonce: body.nonce as Hex,
      v: body.v,
      r: body.r as Hex,
      s: body.s as Hex,
    });
  } catch (err) {
    if (isMissingConfigError(err)) {
      console.error("[deposit] relay unavailable (config not ready):", err);
      return c.json(
        {
          error: "deposit_unavailable",
          message: "Deposits are not available right now. Please try again later.",
        },
        503,
      );
    }
    console.error("[deposit] relay failed:", err);
    return c.json(
      {
        error: "deposit_failed",
        message: "The deposit could not be submitted. Please try again shortly.",
      },
      502,
    );
  }

  // 3. The deposit is confirmed on-chain: record it in the ledger BEFORE reading
  //    the balance, so a confirmed prefund is never lost from the agent's usage
  //    log even if the follow-up balance read blips.
  insertLedgerEntry({
    ts: Date.now(),
    agent: from,
    type: "deposit",
    amountUnits: value.toString(),
    amountUsdc: formatUnits(value, 6),
    recipeId: null,
    counterparty: null,
    txHash,
  });

  let balance: bigint;
  try {
    balance = await readBalance(from);
  } catch (err) {
    // The deposit is confirmed and already recorded; only the display read
    // failed. Report honestly (with the tx hash) rather than 500 — never a
    // fabricated balance.
    console.error("[deposit] post-deposit balance read failed:", err);
    return c.json(
      {
        error: "balance_unavailable",
        message:
          "Your deposit was confirmed on-chain, but the updated balance could " +
          "not be read just now. Check /v1/balance or /v1/usage shortly.",
        txHash,
      },
      503,
    );
  }

  return c.json({
    txHash,
    balanceUnits: balance.toString(),
    balanceUsdc: formatUnits(balance, 6),
  });
});

/** SSE stream of settlement events. */
app.get("/events/stream", (c) => {
  return streamSSE(c, async (stream) => {
    const listener: SettlementListener = (event) => {
      void stream.writeSSE({ event: "settlement", data: JSON.stringify(event) });
    };
    listeners.add(listener);

    stream.onAbort(() => {
      listeners.delete(listener);
    });

    try {
      // Hold the connection open until the client disconnects.
      while (!stream.aborted) {
        await stream.sleep(15_000);
        await stream.writeSSE({ event: "ping", data: String(Date.now()) });
      }
    } finally {
      // Always clean up the listener — even if a write throws or the connection
      // closes without onAbort firing — so the set cannot leak entries.
      listeners.delete(listener);
    }
  });
});

/**
 * Paid Fusion endpoint.
 *
 * 401 (auth) vs 403 (budget): a missing / invalid / expired / mismatched
 * voucher is an auth failure and returns 401. An insufficient escrow balance
 * (or a price above the voucher's maxPrice) returns 403. The client must
 * distinguish them — a 403 means "balance/budget too low", so it should NOT
 * re-sign and retry; it should surface the shortfall to the agent's reasoning.
 */
app.post("/v1/chat/completions", async (c) => {
  // 1. Parse + verify the voucher (recover signer == agent).
  let parsed: ParsedVoucher;
  try {
    parsed = parseVoucherHeader(c.req.header("PAYMENT-SIGNATURE"));
  } catch (err) {
    return c.json(
      { error: "invalid_voucher", message: (err as Error).message },
      401,
    );
  }

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  if (parsed.voucher.expiry <= nowSec) {
    return c.json(
      { error: "voucher_expired", message: "This payment voucher has expired." },
      401,
    );
  }

  let signatureValid = false;
  try {
    const verification = await verifyVoucher({
      voucher: parsed.voucher,
      signature: parsed.signature,
    });
    signatureValid = verification.valid;
  } catch {
    // Malformed signature (bad length / non-hex) makes recovery throw — that is
    // a client input error, not a server fault, so return 401 rather than 500.
    return c.json(
      {
        error: "invalid_signature_format",
        message: "The payment voucher signature is malformed.",
      },
      401,
    );
  }
  if (!signatureValid) {
    return c.json(
      {
        error: "voucher_signature_mismatch",
        message: "Voucher signer does not match the named agent.",
      },
      401,
    );
  }

  const agent = parsed.voucher.agent;

  // 2. Resolve the recipe and price.
  const recipe = getRecipe(parsed.voucher.recipeId);
  if (!recipe) {
    return c.json(
      {
        error: "unknown_recipe",
        message: `No recipe with id "${parsed.voucher.recipeId}".`,
      },
      404,
    );
  }

  const price = recipe.priceUnits;
  if (parsed.voucher.maxPrice < price) {
    return c.json(
      {
        error: "price_exceeds_authorization",
        message:
          "The voucher's authorized maximum is below this recipe's price.",
      },
      403,
    );
  }

  // 2.5. Claim the voucher nonce (replay guard): one signed voucher settles at
  //      most once. Claimed synchronously before the reserve so two identical
  //      submissions cannot both proceed; freed again on any path that does not
  //      charge, and marked permanently spent only once a charge settles.
  if (!claimNonce(agent, parsed.voucher.nonce, parsed.voucher.expiry, nowSec)) {
    return c.json(
      {
        error: "voucher_replayed",
        message:
          "This payment voucher has already been used. Sign a new voucher " +
          "with a fresh nonce for another call.",
      },
      401,
    );
  }

  // 3. Atomically reserve the price against on-chain balance minus holds.
  //    reserve() places the hold before the async read, so concurrent calls
  //    from the same agent cannot both pass when only one is affordable.
  let solvency;
  try {
    solvency = await reserve(agent, price);
  } catch (err) {
    // Chain/config dependency not ready — honest error, no fake balance. The
    // raw cause is logged server-side, never returned to the caller.
    releaseNonce(agent, parsed.voucher.nonce);
    console.error("[solvency] on-chain balance read failed:", err);
    return c.json(
      {
        error: "solvency_check_unavailable",
        message:
          "The payment service is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }

  if (!solvency.ok) {
    // Budget wall: 403, not 402. Client must not re-sign.
    releaseNonce(agent, parsed.voucher.nonce);
    return c.json(
      {
        error: "insufficient_balance",
        message:
          "Prepaid escrow balance is not enough to cover this call. " +
          "Top up the escrow or reduce scope; do not retry with a new voucher.",
        available: solvency.available.toString(),
        required: price.toString(),
      },
      403,
    );
  }

  // 4. The price is already held by reserve(); run Fusion, charge on success.
  let result: FusionResult;
  try {
    let userMessage = "";
    try {
      const body = await c.req.json<{
        messages?: Array<{ role: string; content: string }>;
      }>();
      userMessage =
        body.messages?.filter((m) => m.role === "user").map((m) => m.content).join("\n\n") ??
        "";
    } catch {
      userMessage = "";
    }
    if (userMessage.trim().length === 0) {
      release(agent, price);
      releaseNonce(agent, parsed.voucher.nonce);
      return c.json(
        {
          error: "empty_request",
          message: "Request body must include at least one user message.",
        },
        400,
      );
    }

    result = await runFusion(recipe, userMessage);
  } catch (err) {
    // 5a. Failure: release the hold + nonce, do NOT charge, surface an honest
    //     error. The raw cause is logged server-side, never returned — it can
    //     carry upstream model ids / SDK text (user-visible-layer rule).
    release(agent, price);
    releaseNonce(agent, parsed.voucher.nonce);
    console.error("[fusion] run failed:", err);
    return c.json(
      {
        error: "fusion_failed",
        message:
          "This run could not be completed, so you were not charged. " +
          "Please try again shortly.",
      },
      502,
    );
  }

  // 5b. Success: charge atomically (deduct + 20/80 split in one tx).
  let txHash: Hex;
  try {
    txHash = await charge(
      agent,
      price,
      getAddress(recipe.creatorAddress),
    );
  } catch (err) {
    // Charge failed (or reverted on-chain) after a successful run. Release the
    // hold + nonce and report honestly rather than returning an unpaid result
    // as if settled. The agent can retry the same voucher — nothing was charged.
    release(agent, price);
    releaseNonce(agent, parsed.voucher.nonce);
    console.error("[charge] settlement failed:", err);
    return c.json(
      {
        error: "charge_failed",
        message:
          "The result was produced but settlement did not complete, so you " +
          "were not charged. Please try again shortly.",
      },
      502,
    );
  }

  // 6. Confirmed on-chain (charge() awaited the receipt): mark the voucher
  //    permanently spent, release the hold, and broadcast the settlement.
  settleNonce(agent, parsed.voucher.nonce);
  release(agent, price);

  const event: SettlementEvent = {
    type: "settlement",
    agent,
    creator: getAddress(recipe.creatorAddress),
    amount: price.toString(),
    txHash,
    recipeId: recipe.id,
    ts: Date.now(),
  };
  broadcast(event);

  // Record the settled charge in the agent's ledger so /v1/usage shows real
  // bills. Same millisecond timestamp as the SettlementEvent we just broadcast.
  insertLedgerEntry({
    ts: event.ts,
    agent,
    type: "charge",
    amountUnits: price.toString(),
    amountUsdc: formatUnits(price, 6),
    recipeId: recipe.id,
    counterparty: event.creator,
    txHash,
  });

  return c.json({ ...result, txHash });
});

// --- Server boot -------------------------------------------------------------

/**
 * Start the HTTP server. Skipped under NODE_ENV=test so the app can be imported
 * and exercised via `app.fetch` without binding a port.
 */
function startServer(): void {
  // Fail fast if CHAIN_ID was overridden to something this build cannot honor:
  // the voucher domain and every settlement client are pinned to Injective EVM
  // testnet, so a divergent CHAIN_ID would only let /health misreport the chain.
  if (config.chainId !== injectiveTestnet.id) {
    throw new Error(
      `CHAIN_ID=${config.chainId} is not supported; this build settles only on ` +
        `Injective EVM testnet (${injectiveTestnet.id}). Unset the override.`,
    );
  }

  const port = Number(process.env.PORT ?? 3001);
  serve({ fetch: app.fetch, port }, (info) => {
    // eslint-disable-next-line no-console
    console.log(`0xRecipe backend listening on http://localhost:${info.port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}

export { app, broadcast };
