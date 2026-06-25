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
import { getAddress, type Address, type Hex } from "viem";
import {
  verifyVoucher,
  type PaymentVoucher,
} from "@0xrecipe/x402";
import type { FusionResult, SettlementEvent } from "@0xrecipe/shared";
import { config } from "./config.js";
import { getRecipe } from "./recipes.js";
import { runFusion } from "./fusion.js";
import { reserve, release } from "./solvency.js";
import { charge } from "./escrow.js";

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

/** Convert a USDC decimal string (e.g. "0.05") to 6-decimal smallest units. */
function usdcToUnits(decimal: string): bigint {
  const [whole = "", frac = ""] = decimal.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole || "0") * 1_000_000n + BigInt(fracPadded || "0");
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

  const price = usdcToUnits(recipe.pricePerCallUsdc);
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

  // 3. Atomically reserve the price against on-chain balance minus holds.
  //    reserve() places the hold before the async read, so concurrent calls
  //    from the same agent cannot both pass when only one is affordable.
  let solvency;
  try {
    solvency = await reserve(agent, price);
  } catch (err) {
    // Chain/config dependency not ready — honest error, no fake balance.
    return c.json(
      {
        error: "solvency_check_unavailable",
        message:
          "Could not read the on-chain escrow balance. " +
          (err as Error).message,
      },
      503,
    );
  }

  if (!solvency.ok) {
    // Budget wall: 403, not 402. Client must not re-sign.
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
    // 5a. Failure: release the hold, do NOT charge, surface an honest error.
    release(agent, price);
    return c.json(
      {
        error: "fusion_failed",
        message:
          "This run could not be completed, so you were not charged. " +
          (err as Error).message,
      },
      502,
    );
  }

  // 5b. Success: charge atomically (deduct + 80/20 split in one tx).
  let txHash: Hex;
  try {
    txHash = await charge(
      agent,
      price,
      getAddress(recipe.creatorAddress),
    );
  } catch (err) {
    // Charge failed after a successful run. Release the hold and report
    // honestly rather than returning an unpaid result as if settled.
    release(agent, price);
    return c.json(
      {
        error: "charge_failed",
        message:
          "The result was produced but settlement failed; no charge was made. " +
          (err as Error).message,
      },
      502,
    );
  }

  // 6. Release the hold and broadcast the settlement.
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

  return c.json({ ...result, txHash });
});

// --- Server boot -------------------------------------------------------------

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`0xRecipe backend listening on http://localhost:${info.port}`);
});

export { app, broadcast };
