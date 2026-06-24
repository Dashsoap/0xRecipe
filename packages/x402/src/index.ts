/**
 * @0xrecipe/x402 — on-chain signing primitives for the payment hot path.
 *
 * Two reusable pieces (C7 / C10):
 *   - chain: Injective EVM testnet config + USDC EIP-712 domain constants
 *   - eip3009: gasless prefund authorization (ReceiveWithAuthorization)
 *   - voucher: per-call EIP-712 voucher signing + verification
 */
export * from "./chain.js";
export * from "./eip3009.js";
export * from "./voucher.js";
