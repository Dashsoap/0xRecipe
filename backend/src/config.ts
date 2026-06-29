/**
 * Central configuration.
 *
 * Every value is read from `process.env`. No secret (API key / private key)
 * is ever hard-coded or inlined. Missing required values fail fast via
 * `requireEnv()` with a clear error — we never fall back to a fake/default key.
 *
 * Defaults are only provided for non-secret, well-known constants (chain id,
 * the public testnet USDC address, the OpenAI-compatible gateway base URL
 * placeholder) — never for keys or addresses that must be operator-specific.
 */

function env(name: string): string | undefined {
  const v = process.env[name];
  if (v === undefined) return undefined;
  const trimmed = v.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function envOr(name: string, fallback: string): string {
  return env(name) ?? fallback;
}

/**
 * The OpenAI-compatible gateway base URL.
 *
 * Default is a neutral placeholder only — it is NOT a real endpoint and must be
 * overridden in the environment. We intentionally do not embed any product name.
 */
const DEFAULT_GATEWAY_URL = "https://your-openai-compatible-gateway/v1";

/** Public Injective EVM testnet USDC proxy (token layer, not a secret). */
const DEFAULT_USDC_ADDRESS = "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d";

export interface Config {
  // --- chain ---
  rpcUrl: string;
  chainId: number;
  usdcAddress: string;
  agentEscrowAddress: string | undefined;
  fusionSplitterAddress: string | undefined;
  platformAddr: string | undefined;
  hardcodedCreatorAddr: string | undefined;
  backendPrivateKey: string | undefined;
  /**
   * Optional BIP-39 mnemonic. When BACKEND_PRIVATE_KEY is unset, the backend hot
   * wallet is derived from this at address index 0 (the deployed `onlyBackend`
   * signer). Lets a single funded seed back the relayer/charge signer without
   * copying a raw private key into a second variable. Never logged.
   */
  mnemonic: string | undefined;

  // --- model gateway (OpenAI-compatible) ---
  llmGatewayUrl: string;
  /** Standard source key. */
  llmGatewayKey: string | undefined;
  /** Official source key. */
  llmGatewayKeyPure: string | undefined;

  // --- pricing / voucher ---
  recipePriceUsdc: string | undefined;
  voucherDomain: string | undefined;

  // --- web / CORS ---
  /** Allowed browser origins for cross-origin reads (SSE, balance). Empty/unset
   * means allow any origin — safe here because these endpoints serve only public
   * on-chain data and the paid call is authorized by a signed voucher. */
  corsOrigins: string[] | undefined;

  // --- local/demo fallback ---
  /** When true, escrow reads/writes are mocked and no RPC signer is required. */
  mockChain: boolean;
  /** Mock escrow balance shown to every agent, as a decimal USDC string. */
  mockAgentBalanceUsdc: string;
  /** When true, Fusion returns a deterministic fixture and no LLM key is required. */
  mockFusion: boolean;
}

export const config: Config = {
  rpcUrl: envOr("RPC_URL", "https://k8s.testnet.json-rpc.injective.network/"),
  chainId: Number(envOr("CHAIN_ID", "1439")),
  usdcAddress: envOr("USDC_ADDRESS", DEFAULT_USDC_ADDRESS),
  agentEscrowAddress: env("AGENT_ESCROW_ADDRESS"),
  fusionSplitterAddress: env("FUSION_SPLITTER_ADDRESS"),
  platformAddr: env("PLATFORM_ADDR"),
  hardcodedCreatorAddr: env("HARDCODED_CREATOR_ADDR"),
  backendPrivateKey: env("BACKEND_PRIVATE_KEY"),
  mnemonic: env("MNEMONIC"),

  llmGatewayUrl: envOr("LLM_GATEWAY_URL", DEFAULT_GATEWAY_URL),
  llmGatewayKey: env("LLM_GATEWAY_KEY"),
  llmGatewayKeyPure: env("LLM_GATEWAY_KEY_PURE"),

  recipePriceUsdc: env("RECIPE_PRICE_USDC"),
  voucherDomain: env("VOUCHER_DOMAIN"),

  corsOrigins: env("CORS_ORIGINS")
    ?.split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0),

  mockChain: envOr("MOCK_CHAIN", "0") === "1",
  mockAgentBalanceUsdc: envOr("MOCK_AGENT_BALANCE_USDC", "10.00"),
  mockFusion: envOr("MOCK_FUSION", "0") === "1",
};

/**
 * Assert that a set of config keys are present, otherwise throw a single error
 * listing every missing variable. Use at the edge of a feature (e.g. before a
 * chain write or a model call) so the rest of the app can boot for routes that
 * don't need that dependency.
 */
export function requireEnv<K extends keyof Config>(keys: K[]): void {
  const missing: string[] = [];
  const envNameByKey: Record<keyof Config, string> = {
    rpcUrl: "RPC_URL",
    chainId: "CHAIN_ID",
    usdcAddress: "USDC_ADDRESS",
    agentEscrowAddress: "AGENT_ESCROW_ADDRESS",
    fusionSplitterAddress: "FUSION_SPLITTER_ADDRESS",
    platformAddr: "PLATFORM_ADDR",
    hardcodedCreatorAddr: "HARDCODED_CREATOR_ADDR",
    backendPrivateKey: "BACKEND_PRIVATE_KEY",
    mnemonic: "MNEMONIC",
    llmGatewayUrl: "LLM_GATEWAY_URL",
    llmGatewayKey: "LLM_GATEWAY_KEY",
    llmGatewayKeyPure: "LLM_GATEWAY_KEY_PURE",
    recipePriceUsdc: "RECIPE_PRICE_USDC",
    voucherDomain: "VOUCHER_DOMAIN",
    corsOrigins: "CORS_ORIGINS",
    mockChain: "MOCK_CHAIN",
    mockAgentBalanceUsdc: "MOCK_AGENT_BALANCE_USDC",
    mockFusion: "MOCK_FUSION",
  };

  for (const key of keys) {
    const value = config[key];
    if (value === undefined || value === null || value === "") {
      missing.push(envNameByKey[key]);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in your environment (see backend/.env.example). ` +
        `Secrets are never bundled — the service refuses to run with fake values.`,
    );
  }
}
