// R1 on-chain spike: prove the whole settlement chain on Injective testnet.
//  1. agent signs EIP-3009 ReceiveWithAuthorization (gasless)
//  2. backend relays escrow.depositFor -> credits balances[agent] (the SIGNER)
//  3. backend escrow.charge(agent, amount, creator) -> debit + 80/20 atomic split
// Reads MNEMONIC from .env (never printed). Run: cd backend && node --env-file=../.env scripts/spike-deposit-charge.mjs
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createPublicClient, createWalletClient, http, defineChain, formatUnits, parseUnits, parseSignature } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const M = process.env.MNEMONIC;
if (!M) { console.error("MNEMONIC not set"); process.exit(1); }
const RPC = process.env.DEPLOY_RPC || "https://1439.rpc.thirdweb.com";
const EXPLORER = "https://testnet.blockscout.injective.network";

const dep = JSON.parse(readFileSync(new URL("../../contracts/deployments/injective-testnet-1439.json", import.meta.url)));
const { usdc: USDC, agentEscrow: ESCROW, fusionSplitter: SPLITTER, platform: PLATFORM, creator: CREATOR } = dep;

const chain = defineChain({ id: 1439, name: "Injective EVM Testnet", nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const agent = mnemonicToAccount(M, { addressIndex: 1 });
const backend = mnemonicToAccount(M, { addressIndex: 0 });
const pub = createPublicClient({ chain, transport: http(RPC) });
const beWallet = createWalletClient({ account: backend, chain, transport: http(RPC) });

const escrowAbi = JSON.parse(readFileSync(new URL("../../contracts/out/AgentEscrow.sol/AgentEscrow.json", import.meta.url))).abi;
const erc20 = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "version", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
];

async function waitReceipt(hash, tries = 90, delayMs = 2000) {
  for (let i = 0; i < tries; i++) { try { const r = await pub.getTransactionReceipt({ hash }); if (r) return r; } catch {} await new Promise((r) => setTimeout(r, delayMs)); }
  return null;
}
const usdcBal = (a) => pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [a] });
const escrowBal = (a) => pub.readContract({ address: ESCROW, abi: escrowAbi, functionName: "balanceOf", args: [a] });
const fmt = (v) => formatUnits(v, 6);

let version = "2";
try { version = await pub.readContract({ address: USDC, abi: erc20, functionName: "version" }); } catch {}
console.log("escrow:", ESCROW, "\nsplitter:", SPLITTER, "\nagent:", agent.address, "\nUSDC version:", version, "\n");

const DEPOSIT = parseUnits("10", 6); // 10 USDC
const CHARGE = parseUnits("5", 6);   // 5 USDC -> creator 4 / platform 1
const expCreator = (CHARGE * 800000n) / 1000000n;
const expPlatform = CHARGE - expCreator;

const before = { agentU: await usdcBal(agent.address), creatorU: await usdcBal(CREATOR), platformU: await usdcBal(PLATFORM), escrowA: await escrowBal(agent.address) };
console.log("BEFORE  agentUSDC=%s creatorUSDC=%s platformUSDC=%s escrowBal[agent]=%s", fmt(before.agentU), fmt(before.creatorU), fmt(before.platformU), fmt(before.escrowA));

// 1) agent signs EIP-3009 ReceiveWithAuthorization (gasless)
const validAfter = 0n;
const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
const nonce = ("0x" + randomBytes(32).toString("hex"));
const sig = await agent.signTypedData({
  domain: { name: "USDC", version, chainId: 1439, verifyingContract: USDC },
  types: { ReceiveWithAuthorization: [
    { name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" } ] },
  primaryType: "ReceiveWithAuthorization",
  message: { from: agent.address, to: ESCROW, value: DEPOSIT, validAfter, validBefore, nonce },
});
// parseSignature splits + normalizes v (handles 0/1 -> 27/28) — safer than manual slicing.
const { r, s, v: vRaw, yParity } = parseSignature(sig);
const v = vRaw !== undefined ? Number(vRaw) : 27 + yParity;
console.log("\n[1] agent signed ReceiveWithAuthorization (gasless). relaying depositFor...");

// 2) backend relays depositFor
const h1 = await beWallet.writeContract({ address: ESCROW, abi: escrowAbi, functionName: "depositFor", args: [agent.address, DEPOSIT, validAfter, validBefore, nonce, v, r, s] });
console.log("    depositFor tx:", h1);
const rc1 = await waitReceipt(h1);
if (!rc1 || rc1.status !== "success") { console.error("depositFor failed:", rc1 && rc1.status); process.exit(1); }
const afterDep = { agentU: await usdcBal(agent.address), escrowA: await escrowBal(agent.address) };
const credited = afterDep.escrowA - before.escrowA;
console.log("    escrowBal[agent] %s -> %s (credited %s)  agentUSDC -> %s", fmt(before.escrowA), fmt(afterDep.escrowA), fmt(credited), fmt(afterDep.agentU));
console.log("    R1 check (credited to SIGNER == deposit):", credited === DEPOSIT ? "PASS ✓" : "FAIL ✗");

// 3) backend charge -> 80/20 split
console.log("\n[2] backend charge(agent, 5 USDC, creator)...");
const h2 = await beWallet.writeContract({ address: ESCROW, abi: escrowAbi, functionName: "charge", args: [agent.address, CHARGE, CREATOR] });
console.log("    charge tx:", h2);
const rc2 = await waitReceipt(h2);
if (!rc2 || rc2.status !== "success") { console.error("charge failed:", rc2 && rc2.status); process.exit(1); }
const after = { creatorU: await usdcBal(CREATOR), platformU: await usdcBal(PLATFORM), escrowA: await escrowBal(agent.address) };
const dC = after.creatorU - before.creatorU, dP = after.platformU - before.platformU, dE = afterDep.escrowA - after.escrowA;
console.log("    creatorUSDC +%s (expect %s) %s", fmt(dC), fmt(expCreator), dC === expCreator ? "PASS ✓" : "FAIL ✗");
console.log("    platformUSDC +%s (expect %s) %s", fmt(dP), fmt(expPlatform), dP === expPlatform ? "PASS ✓" : "FAIL ✗");
console.log("    escrowBal[agent] -%s (expect %s) %s", fmt(dE), fmt(CHARGE), dE === CHARGE ? "PASS ✓" : "FAIL ✗");

const ok = credited === DEPOSIT && dC === expCreator && dP === expPlatform && dE === CHARGE;
console.log("\n=== %s ===", ok ? "ALL CHECKS PASSED — R1 verified on-chain" : "SOME CHECKS FAILED");
console.log("depositFor:", `${EXPLORER}/tx/${h1}`);
console.log("charge    :", `${EXPLORER}/tx/${h2}`);
process.exit(ok ? 0 : 1);
