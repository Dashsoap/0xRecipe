import { defineChain } from "viem";

/**
 * Injective EVM testnet. Chain params live in one place so the whole app
 * stays consistent. Public RPC and explorer only — no secrets, no keys.
 *
 * Endpoints are overridable via NEXT_PUBLIC_* env (non-sensitive, public
 * infra only). If unset we fall back to the public testnet endpoints.
 */
const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://k8s.testnet.json-rpc.injective.network/";

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ??
  "https://testnet.blockscout.injective.network";

export const injectiveTestnet = defineChain({
  id: 1439,
  name: "Injective EVM testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
  blockExplorers: {
    default: { name: "Blockscout", url: EXPLORER_URL },
  },
  testnet: true,
});

/** Base URL of the on-chain explorer, for building tx / address links. */
export const explorerBaseUrl = EXPLORER_URL;

/** Build an explorer link for a transaction hash. */
export function explorerTxUrl(txHash: string): string {
  return `${explorerBaseUrl}/tx/${txHash}`;
}

/** Build an explorer link for an address. */
export function explorerAddressUrl(address: string): string {
  return `${explorerBaseUrl}/address/${address}`;
}
