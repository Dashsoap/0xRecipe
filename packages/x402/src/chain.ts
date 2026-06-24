/**
 * Injective EVM testnet chain config + USDC EIP-712 domain constants.
 *
 * Single source of truth for the on-chain parameters every signer/verifier in
 * this package shares. Chain facts are pinned from first-hand verification
 * (see IMPLEMENTATION_PLAN §0).
 */
import { defineChain } from "viem";

/** Injective EVM testnet (chainId 1439). */
export const injectiveTestnet = defineChain({
  id: 1439,
  name: "Injective EVM Testnet",
  nativeCurrency: {
    name: "Injective",
    symbol: "INJ",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://k8s.testnet.json-rpc.injective.network/"],
    },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://testnet.blockscout.injective.network",
    },
  },
  testnet: true,
});

/** Chain id for Injective EVM testnet. */
export const CHAIN_ID = 1439 as const;

/**
 * USDC EIP-712 domain `name` for the testnet `FiatTokenInjectiveV2_2`.
 * Sign-time best practice is to confirm against the on-chain `name()` /
 * `DOMAIN_SEPARATOR()` before signing (see IMPLEMENTATION_PLAN §0).
 */
export const USDC_DOMAIN_NAME = "USDC" as const;

/** USDC EIP-712 domain `version` for the testnet token. */
export const USDC_DOMAIN_VERSION = "2" as const;

/**
 * Testnet USDC proxy address on Injective EVM (chainId 1439).
 *
 * TESTNET ONLY — not a mainnet address. The deployed implementation is
 * `FiatTokenInjectiveV2_2` with the full EIP-3009 surface
 * (`transferWithAuthorization` / `receiveWithAuthorization` /
 * `cancelAuthorization` / `authorizationState`).
 */
export const TESTNET_USDC_ADDRESS =
  "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d" as const;
