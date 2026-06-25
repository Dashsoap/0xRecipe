import { describe, it, expect, vi } from "vitest";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  signVoucher,
  injectiveTestnet,
  type PaymentVoucher,
} from "@0xrecipe/x402";

// Mock every chain / gateway dependency so the route exercises ONLY the
// in-process payment logic (voucher verify + nonce replay guard). No RPC, no
// model gateway, no escrow contract is touched.
vi.mock("../src/solvency.js", () => ({
  reserve: vi.fn(async (_agent: unknown, price: bigint) => ({
    ok: true,
    balance: price,
    held: 0n,
    available: price,
  })),
  release: vi.fn(() => {}),
}));

vi.mock("../src/escrow.js", () => ({
  charge: vi.fn(async () => `0x${"ab".repeat(32)}`),
}));

vi.mock("../src/fusion.js", () => ({
  runFusion: vi.fn(async () => ({
    consensus: "The reviewers broadly agree.",
    contradictions: [],
    partial_coverage: [],
    unique_insights: [],
    blind_spots: [],
    synthesized_answer: "All clear.",
  })),
}));

// NODE_ENV=test (set by vitest.config) keeps the server boot guarded, so the
// app imports without binding a port.
import { app } from "../src/index.js";

const ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const walletClient = createWalletClient({
  account: ACCOUNT,
  chain: injectiveTestnet,
  transport: http(),
});

/** Build the PAYMENT-SIGNATURE header for a real, signed voucher. */
async function buildHeader(voucher: PaymentVoucher): Promise<string> {
  const signature = await signVoucher({ walletClient, account: ACCOUNT, voucher });
  return JSON.stringify({
    voucher: {
      agent: voucher.agent,
      recipeId: voucher.recipeId,
      maxPrice: voucher.maxPrice.toString(),
      nonce: voucher.nonce.toString(),
      expiry: voucher.expiry.toString(),
    },
    signature,
  });
}

function makeRequest(header: string): Request {
  return new Request("http://localhost/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "PAYMENT-SIGNATURE": header,
    },
    body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
  });
}

describe("POST /v1/chat/completions — voucher replay guard", () => {
  it("charges once (200) then rejects an identical replayed voucher (401)", async () => {
    const voucher: PaymentVoucher = {
      agent: ACCOUNT.address,
      recipeId: "legal-reviewer-v1",
      maxPrice: 50_000n, // >= recipe price (0.05 USDC = 50000 base units)
      nonce: 424242n,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
    };
    const header = await buildHeader(voucher);

    // First call: voucher is fresh -> runs Fusion, charges, settles.
    const res1 = await app.fetch(makeRequest(header));
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as { txHash?: string; synthesized_answer?: string };
    expect(body1.txHash).toBeDefined();
    expect(body1.synthesized_answer).toBe("All clear.");

    // Second identical call (same nonce): rejected as a replay.
    const res2 = await app.fetch(makeRequest(header));
    expect(res2.status).toBe(401);
    const body2 = (await res2.json()) as { error?: string };
    expect(body2.error).toBe("voucher_replayed");
  });
});
