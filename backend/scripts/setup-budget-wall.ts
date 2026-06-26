/**
 * Budget-wall setup (Stage 3 demo prep).
 *
 * Leaves the demo agent's on-chain escrow holding EXACTLY enough for a small,
 * fixed number of paid calls, so the agent demo predictably hits the prepaid
 * budget wall (HTTP 403 insufficient_balance) on the call after its budget runs
 * out. No faucet needed: the backend funds the agent a little INJ for gas, then
 * the agent withdraws its own surplus escrow back to its wallet.
 *
 *   node --env-file=../.env --import tsx scripts/setup-budget-wall.ts <targetUsdc>
 *
 * <targetUsdc> defaults to 0.10 (two calls at $0.05). Reads MNEMONIC; prints no
 * secret. Idempotent-ish: if escrow already <= target, only tops up gas.
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  formatUnits,
  parseUnits,
  formatEther,
  parseEther,
  parseSignature,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";

const TARGET_USDC = process.argv[2] ?? "0.10";
const M = process.env.MNEMONIC;
if (!M) {
  console.error("MNEMONIC not set");
  process.exit(1);
}
const RPC = process.env.RPC_URL || "https://1439.rpc.thirdweb.com";
const dep = JSON.parse(
  readFileSync(new URL("../../contracts/deployments/injective-testnet-1439.json", import.meta.url), "utf8"),
);

const chain = defineChain({
  id: 1439,
  name: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const backend = mnemonicToAccount(M, { addressIndex: 0 });
const agent = mnemonicToAccount(M, { addressIndex: 1 });
const pub = createPublicClient({ chain, transport: http(RPC) });
const beWallet = createWalletClient({ account: backend, chain, transport: http(RPC) });
const agentWallet = createWalletClient({ account: agent, chain, transport: http(RPC) });

const escrowAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
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
] as const;
const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
] as const;

const ESCROW = dep.agentEscrow as `0x${string}`;
const USDC = dep.usdc as `0x${string}`;
const escrowBal = () => pub.readContract({ address: ESCROW, abi: escrowAbi, functionName: "balanceOf", args: [agent.address] });
const usdcBal = (a: `0x${string}`) => pub.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [a] });

async function waitReceipt(hash: `0x${string}`) {
  return pub.waitForTransactionReceipt({ hash, timeout: 90_000 });
}

async function main() {
  const target = parseUnits(TARGET_USDC, 6);
  console.log(`agent: ${agent.address}`);
  const startEscrow = await escrowBal();
  const agentInj = await pub.getBalance({ address: agent.address });
  console.log(`escrow: ${formatUnits(startEscrow, 6)} USDC   agent INJ gas: ${formatEther(agentInj)}`);
  console.log(`target escrow: ${TARGET_USDC} USDC\n`);

  if (startEscrow === target) {
    console.log("Escrow already exactly at target — budget wall armed.");
    return;
  }

  if (startEscrow > target) {
    // --- DRAIN: agent withdraws surplus (needs a little INJ for gas) ---
    if (agentInj < parseEther("0.02")) {
      console.log("[1] backend funding agent 0.05 INJ for gas…");
      const h = await beWallet.sendTransaction({ to: agent.address, value: parseEther("0.05") });
      await waitReceipt(h);
      console.log("    funded. agent INJ:", formatEther(await pub.getBalance({ address: agent.address })));
    }
    const surplus = startEscrow - target;
    console.log(`\n[2] agent withdrawing surplus ${formatUnits(surplus, 6)} USDC (leaving ${TARGET_USDC})…`);
    const h2 = await agentWallet.writeContract({ address: ESCROW, abi: escrowAbi, functionName: "withdraw", args: [surplus] });
    console.log("    withdraw tx:", h2);
    const rc = await waitReceipt(h2);
    if (rc.status !== "success") {
      console.error("    withdraw reverted");
      process.exit(1);
    }
  } else {
    // --- TOP-UP: agent deposits the deficit (gasless EIP-3009, backend relays) ---
    const deficit = target - startEscrow;
    const wallet = await usdcBal(agent.address);
    console.log(`[1] need +${formatUnits(deficit, 6)} USDC; agent wallet USDC: ${formatUnits(wallet, 6)}`);
    if (wallet < deficit) {
      console.error(`    agent wallet has too little USDC to top up. Fund it via the Circle faucet.`);
      process.exit(1);
    }
    let version = "2";
    try {
      version = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: "version" });
    } catch {
      /* default "2" */
    }
    const validAfter = 0n;
    const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = ("0x" + randomBytes(32).toString("hex")) as `0x${string}`;
    const sig = await agent.signTypedData({
      domain: { name: "USDC", version, chainId: 1439, verifyingContract: USDC },
      types: {
        ReceiveWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "ReceiveWithAuthorization",
      message: { from: agent.address, to: ESCROW, value: deficit, validAfter, validBefore, nonce },
    });
    const { r, s, v: vRaw, yParity } = parseSignature(sig);
    const v = vRaw !== undefined ? Number(vRaw) : 27 + yParity;
    console.log(`\n[2] backend relaying gasless depositFor(+${formatUnits(deficit, 6)} USDC)…`);
    const h = await beWallet.writeContract({
      address: ESCROW,
      abi: escrowAbi,
      functionName: "depositFor",
      args: [agent.address, deficit, validAfter, validBefore, nonce, v, r, s],
    });
    console.log("    depositFor tx:", h);
    const rc = await waitReceipt(h);
    if (rc.status !== "success") {
      console.error("    depositFor reverted");
      process.exit(1);
    }
  }

  const endEscrow = await escrowBal();
  console.log(`\nescrow now: ${formatUnits(endEscrow, 6)} USDC`);
  console.log(endEscrow === target ? "OK ✓ budget wall armed" : "WARN: escrow != target");
}

void main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
