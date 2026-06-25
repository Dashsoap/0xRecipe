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
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
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
      { name: "sig", type: "bytes" },
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
  account: ReturnType<typeof privateKeyToAccount>;
}

let backendWalletSingleton: BackendWallet | undefined;

/** Lazily build the backend signer; fail fast if the key is missing. */
function getBackendWallet(): BackendWallet {
  if (!backendWalletSingleton) {
    requireEnv(["backendPrivateKey"]);
    const raw = config.backendPrivateKey as string;
    const pk = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
    const account = privateKeyToAccount(pk);
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
  sig: Hex;
}

/**
 * Relay a prefund: the backend submits the agent's signed authorization so the
 * agent pays no gas. Records the balance to the signer `from`.
 */
export async function relayDeposit(params: RelayDepositParams): Promise<Hex> {
  const address = escrowAddress();
  const { walletClient, account } = getBackendWallet();
  return walletClient.writeContract({
    address,
    abi: AGENT_ESCROW_ABI,
    functionName: "depositFor",
    args: [
      getAddress(params.from),
      params.value,
      params.validAfter,
      params.validBefore,
      params.nonce,
      params.sig,
    ],
    account,
    chain: injectiveTestnet,
  });
}

/**
 * Charge an agent after a successful call: one atomic tx that deducts the
 * balance, transfers to the splitter, and distributes 20/80. Returns the tx
 * hash. `onlyBackend` on-chain; signed by the backend hot wallet.
 */
export async function charge(
  agent: Address,
  amount: bigint,
  creator: Address,
): Promise<Hex> {
  const address = escrowAddress();
  const { walletClient, account } = getBackendWallet();
  return walletClient.writeContract({
    address,
    abi: AGENT_ESCROW_ABI,
    functionName: "charge",
    args: [getAddress(agent), amount, getAddress(creator)],
    account,
    chain: injectiveTestnet,
  });
}
