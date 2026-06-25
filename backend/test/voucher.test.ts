import { describe, it, expect } from "vitest";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  signVoucher,
  verifyVoucher,
  injectiveTestnet,
  type PaymentVoucher,
} from "@0xrecipe/x402";

// Well-known local test keys (anvil accounts #0 and #1). Signing EIP-712 typed
// data is purely local — the http() transport is never contacted.
const ACCOUNT = privateKeyToAccount(
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
);
const OTHER = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
);

const walletClient = createWalletClient({
  account: ACCOUNT,
  chain: injectiveTestnet,
  transport: http(),
});

function baseVoucher(): PaymentVoucher {
  return {
    agent: ACCOUNT.address,
    recipeId: "legal-reviewer-v1",
    maxPrice: 50_000n,
    nonce: 1n,
    expiry: 9_999_999_999n,
  };
}

describe("voucher sign / verify", () => {
  it("verifies a freshly signed voucher (valid, signer == account)", async () => {
    const voucher = baseVoucher();
    const signature = await signVoucher({ walletClient, account: ACCOUNT, voucher });

    const result = await verifyVoucher({ voucher, signature });

    expect(result.valid).toBe(true);
    expect(result.signer.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
  });

  it("rejects a voucher whose field was tampered after signing", async () => {
    const voucher = baseVoucher();
    const signature = await signVoucher({ walletClient, account: ACCOUNT, voucher });

    // Raise the authorized price after signing; the recovered signer no longer
    // matches the named agent.
    const tampered: PaymentVoucher = { ...voucher, maxPrice: 999_999n };
    const result = await verifyVoucher({ voucher: tampered, signature });

    expect(result.valid).toBe(false);
  });

  it("rejects a voucher whose .agent is a different address than the signer", async () => {
    // Agent field claims OTHER's address, but ACCOUNT actually signs it
    // (impersonation attempt). verifyVoucher must reject it.
    const voucher: PaymentVoucher = { ...baseVoucher(), agent: OTHER.address };
    const signature = await signVoucher({ walletClient, account: ACCOUNT, voucher });

    const result = await verifyVoucher({ voucher, signature });

    expect(result.valid).toBe(false);
    expect(result.signer.toLowerCase()).toBe(ACCOUNT.address.toLowerCase());
  });
});
