import { describe, it, expect, beforeAll } from "vitest";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  injectiveTestnet,
  signVoucher,
  type PaymentVoucher,
} from "@0xrecipe/x402";

process.env.MOCK_CHAIN = "1";
process.env.MOCK_FUSION = "1";
process.env.MOCK_AGENT_BALANCE_USDC = "10.00";

const account = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f094538f4c69513d6b8e4019cf151b5f0c0d4b5d",
);
const walletClient = createWalletClient({
  account,
  chain: injectiveTestnet,
  transport: http(),
});

let app: (typeof import("../src/index.js"))["app"];

beforeAll(async () => {
  ({ app } = await import("../src/index.js"));
});

async function buildHeader(voucher: PaymentVoucher): Promise<string> {
  const signature = await signVoucher({ walletClient, account, voucher });
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

describe("mock mode", () => {
  it("runs the paid route without chain signer or LLM keys", async () => {
    const health = await app.fetch(new Request("http://localhost/health"));
    expect(health.status).toBe(200);
    const healthBody = (await health.json()) as {
      mock: { chain: boolean; fusion: boolean };
      configured: Record<string, boolean>;
    };
    expect(healthBody.mock).toEqual({ chain: true, fusion: true });
    expect(healthBody.configured.backendWallet).toBe(true);
    expect(healthBody.configured.standardSource).toBe(true);

    const voucher: PaymentVoucher = {
      agent: account.address,
      recipeId: "legal-reviewer-v1",
      maxPrice: 1_000_000n,
      nonce: 9001n,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 60),
    };
    const res = await app.fetch(
      new Request("http://localhost/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "PAYMENT-SIGNATURE": await buildHeader(voucher),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Review this lease." }],
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      contradictions?: string[];
      synthesized_answer?: string;
      txHash?: string;
    };
    expect(body.contradictions?.length).toBeGreaterThan(0);
    expect(body.synthesized_answer).toContain("mock Fusion result");
    expect(body.txHash).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
