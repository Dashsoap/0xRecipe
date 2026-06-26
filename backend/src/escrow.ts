/**
 * On-chain escrow interaction skeleton (viem).
 *
 * The backend hot wallet (BACKEND_PRIVATE_KEY) plays two roles:
 *   - deposit relayer: submits the agent's gasless prefund authorization via
 *     `escrow.depositFor(...)` (the agent pays no gas).
 *   - charge signer: calls `escrow.charge(agent, amount, creator)` which is
 *     `onlyBackend` and performs deduct + transfer-to-splitter + distribute in
 *     one atomic transaction.
 *
 * Reads (`balanceOf`) work with just an RPC_URL. Writes require
 * BACKEND_PRIVATE_KEY and the deployed AGENT_ESCROW_ADDRESS; both fail fast with
 * a clear error if unset. We never fabricate a tx hash or balance.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  type Account,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import { injectiveTestnet } from "@0xrecipe/x402";
import { config, requireEnv } from "./config.js";

/**
 * Minimal AgentEscrow ABI — only the surface the backend exercises.
 * Mirrors the contract interface in IMPLEMENTATION_PLAN §1.5.
 */
export const AGENT_ESCROW_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "agent", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "depositFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "charge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agent", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "creator", type: "address" },
    ],
    outputs: [],
  },
] as const;

let publicClientSingleton: PublicClient | undefined;

/** Lazily build the read-only RPC client. */
export function getPublicClient(): PublicClient {
  if (!publicClientSingleton) {
    publicClientSingleton = createPublicClient({
      chain: injectiveTestnet,
      transport: http(config.rpcUrl),
    });
  }
  return publicClientSingleton;
}

interface BackendWallet {
  walletClient: WalletClient;
  account: Account;
}

let backendWalletSingleton: BackendWallet | undefined;

/**
 * Resolve the backend signing account. Prefers an explicit BACKEND_PRIVATE_KEY;
 * if that is unset, derives address index 0 from MNEMONIC (the deployed
 * `onlyBackend` signer). One funded seed can back the relayer/charge signer
 * without copying a raw private key into a second variable. Fails fast with a
 * clear error if neither is set — never a fabricated key.
 */
function resolveBackendAccount(): Account {
  if (config.backendPrivateKey) {
    const raw = config.backendPrivateKey;
    const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
    return privateKeyToAccount(pk);
  }
  if (config.mnemonic) {
    return mnemonicToAccount(config.mnemonic, { addressIndex: 0 });
  }
  // Surface the same shape of error requireEnv produces so callers can map it.
  throw new Error(
    "Missing required environment variable(s): BACKEND_PRIVATE_KEY or MNEMONIC. " +
      "Set one in your environment (see backend/.env.example). " +
      "Secrets are never bundled — the service refuses to run with fake values.",
  );
}

/** Lazily build the backend signer; fail fast if no signing source is set. */
function getBackendWallet(): BackendWallet {
  if (!backendWalletSingleton) {
    const account = resolveBackendAccount();
    const walletClient = createWalletClient({
      account,
      chain: injectiveTestnet,
      transport: http(config.rpcUrl),
    });
    backendWalletSingleton = { walletClient, account };
  }
  return backendWalletSingleton;
}

/** Resolve and checksum the deployed escrow address; fail fast if unset. */
function escrowAddress(): Address {
  requireEnv(["agentEscrowAddress"]);
  return getAddress(config.agentEscrowAddress as string);
}

/**
 * Read an agent's prepaid escrow balance (USDC smallest units).
 * Needs only RPC_URL + AGENT_ESCROW_ADDRESS.
 */
export async function readBalance(agent: Address): Promise<bigint> {
  const address = escrowAddress();
  const client = getPublicClient();
  return client.readContract({
    address,
    abi: AGENT_ESCROW_ABI,
    functionName: "balanceOf",
    args: [getAddress(agent)],
  });
}

/** Parameters for {@link relayDeposit} (an agent's gasless prefund). */
export interface RelayDepositParams {
  from: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
  /** EIP-3009 signature components (the contract takes v, r, s — not packed). */
  v: number;
  r: Hex;
  s: Hex;
}

/** How long to wait for a relayed deposit receipt before treating it as failed (ms). */
const DEPOSIT_RECEIPT_TIMEOUT_MS = 60_000;

/**
 * Relay a prefund: the backend submits the agent's signed authorization so the
 * agent pays no gas. Records the balance to the signer `from`. Mirrors charge():
 * waits for the transaction receipt and requires an on-chain success before
 * returning, so a resolved call means the deposit is confirmed (not merely
 * broadcast) and the caller can read an accurate post-deposit balance.
 */
export async function relayDeposit(params: RelayDepositParams): Promise<Hex> {
  const address = escrowAddress();
  const { walletClient, account } = getBackendWallet();
  const hash = await walletClient.writeContract({
    address,
    abi: AGENT_ESCROW_ABI,
    functionName: "depositFor",
    args: [
      getAddress(params.from),
      params.value,
      params.validAfter,
      params.validBefore,
      params.nonce,
      params.v,
      params.r,
      params.s,
    ],
    account,
    chain: injectiveTestnet,
  });

  // writeContract resolves on broadcast, NOT on mining. Wait for the receipt and
  // require an on-chain success so the endpoint returns only once the prefund is
  // settled — a reverted/dropped deposit must not look confirmed.
  const receipt = await getPublicClient().waitForTransactionReceipt({
    hash,
    timeout: DEPOSIT_RECEIPT_TIMEOUT_MS,
  });
  if (receipt.status !== "success") {
    throw new Error(`Deposit transaction ${hash} reverted on-chain.`);
  }
  return hash;
}

/** How long to wait for a charge tx receipt before treating it as failed (ms). */
const CHARGE_RECEIPT_TIMEOUT_MS = 60_000;

/**
 * Charge an agent after a successful call: one atomic tx that deducts the
 * balance, transfers to the splitter, and distributes 20/80. Waits for the
 * transaction receipt and requires an on-chain success before returning, so a
 * resolved call means the charge is settled (not merely broadcast to the
 * mempool). Returns the tx hash. `onlyBackend` on-chain; signed by the backend
 * hot wallet.
 */
export async function charge(
  agent: Address,
  amount: bigint,
  creator: Address,
): Promise<Hex> {
  const address = escrowAddress();
  const { walletClient, account } = getBackendWallet();
  const hash = await walletClient.writeContract({
    address,
    abi: AGENT_ESCROW_ABI,
    functionName: "charge",
    args: [getAddress(agent), amount, getAddress(creator)],
    account,
    chain: injectiveTestnet,
  });

  // writeContract resolves on broadcast, NOT on mining. Wait for the receipt and
  // require an on-chain success before the caller treats the charge as settled —
  // otherwise a reverted/dropped charge would be reported as a paid settlement
  // and the solvency hold would release while the balance is still undeducted.
  const receipt = await getPublicClient().waitForTransactionReceipt({
    hash,
    timeout: CHARGE_RECEIPT_TIMEOUT_MS,
  });
  if (receipt.status !== "success") {
    throw new Error(`Charge transaction ${hash} reverted on-chain.`);
  }
  return hash;
}
