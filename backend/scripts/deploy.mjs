// Deploy FusionPayoutSplitter + AgentEscrow to Injective EVM testnet (1439).
// Signs locally with index0 from .env MNEMONIC (never printed). Resilient + resumable:
// robust receipt polling, and SPLITTER_TX=<hash> reuses an already-sent splitter tx.
// Run: cd backend && node --env-file=../.env scripts/deploy.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain, formatEther } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const MNEMONIC = process.env.MNEMONIC;
if (!MNEMONIC) { console.error("MNEMONIC not set in .env"); process.exit(1); }

// thirdweb RPC by default: the k8s public RPC's eth_getTransactionReceipt is unreliable.
const RPC = process.env.DEPLOY_RPC || "https://1439.rpc.thirdweb.com";
const USDC = process.env.USDC_ADDRESS || "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d";
const EXPLORER = "https://testnet.blockscout.injective.network";
const SPLITTER_ADDR = process.env.SPLITTER_ADDR || null; // reuse an already-deployed splitter
const SPLITTER_TX = process.env.SPLITTER_TX || process.argv[2] || null;

const chain = defineChain({
  id: 1439, name: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: EXPLORER } },
});

const deployer = mnemonicToAccount(MNEMONIC, { addressIndex: 0 });
const creator = mnemonicToAccount(MNEMONIC, { addressIndex: 2 });
const platform = mnemonicToAccount(MNEMONIC, { addressIndex: 3 });

const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account: deployer, chain, transport: http(RPC) });

// Robust receipt poll: tolerate "not found yet" from a flaky/load-balanced RPC.
async function waitReceipt(hash, tries = 90, delayMs = 2000) {
  for (let i = 0; i < tries; i++) {
    try { const r = await pub.getTransactionReceipt({ hash }); if (r) return r; } catch { /* not yet */ }
    await new Promise((res) => setTimeout(res, delayMs));
  }
  return null;
}

const cid = await pub.getChainId();
if (cid !== 1439) { console.error("Wrong chain:", cid); process.exit(1); }
console.log("deployer :", deployer.address, "INJ=" + formatEther(await pub.getBalance({ address: deployer.address })));

const art = (p) => { const j = JSON.parse(readFileSync(new URL(`../../contracts/out/${p}`, import.meta.url))); return { abi: j.abi, bytecode: j.bytecode.object }; };
const splitterArt = art("FusionPayoutSplitter.sol/FusionPayoutSplitter.json");
const escrowArt = art("AgentEscrow.sol/AgentEscrow.json");

// --- Splitter: reuse a known address, else a prior tx, else deploy fresh ---
let splitter;
if (SPLITTER_ADDR) {
  const code = await pub.getCode({ address: SPLITTER_ADDR }).catch(() => undefined);
  if (code && code !== "0x") { splitter = SPLITTER_ADDR; console.log("\nReusing splitter at", splitter, "(codeLen", (code.length - 2) / 2 + ")"); }
  else console.log("\nSPLITTER_ADDR has no code; will deploy fresh.");
}
if (!splitter && SPLITTER_TX) {
  console.log("\nChecking prior splitter tx", SPLITTER_TX, "...");
  const r = await waitReceipt(SPLITTER_TX);
  if (r && r.status === "success" && r.contractAddress) { splitter = r.contractAddress; console.log("  reused splitter :", splitter); }
  else console.log("  prior tx not usable (status=" + (r && r.status) + "); deploying fresh.");
}
if (!splitter) {
  console.log("\nDeploying FusionPayoutSplitter(usdc, platform)...");
  const h = await wallet.deployContract({ abi: splitterArt.abi, bytecode: splitterArt.bytecode, args: [USDC, platform.address] });
  console.log("  tx", h);
  const r = await waitReceipt(h);
  if (!r || r.status !== "success") { console.error("Splitter deploy failed/unconfirmed:", h); process.exit(1); }
  splitter = r.contractAddress;
  console.log("  splitter :", splitter);
}

// --- Escrow ---
console.log("\nDeploying AgentEscrow(usdc, backend, splitter)...");
const h2 = await wallet.deployContract({ abi: escrowArt.abi, bytecode: escrowArt.bytecode, args: [USDC, deployer.address, splitter] });
console.log("  tx", h2);
const r2 = await waitReceipt(h2);
if (!r2 || r2.status !== "success") { console.error("Escrow deploy failed/unconfirmed:", h2); process.exit(1); }
const escrow = r2.contractAddress;
console.log("  escrow   :", escrow);

const out = {
  chainId: 1439, rpc: RPC, usdc: USDC,
  fusionSplitter: splitter, agentEscrow: escrow,
  backend: deployer.address, platform: platform.address, creator: creator.address,
  tx: { splitter: SPLITTER_TX || "(fresh)", escrow: h2 },
};
mkdirSync(new URL("../../contracts/deployments/", import.meta.url), { recursive: true });
writeFileSync(new URL("../../contracts/deployments/injective-testnet-1439.json", import.meta.url), JSON.stringify(out, null, 2) + "\n");

console.log("\n=== DONE ===");
console.log("Splitter :", `${EXPLORER}/address/${splitter}`);
console.log("Escrow   :", `${EXPLORER}/address/${escrow}`);
console.log("\nAdd to .env (public addresses, safe):");
console.log(`FUSION_SPLITTER_ADDRESS=${splitter}`);
console.log(`AGENT_ESCROW_ADDRESS=${escrow}`);
console.log(`PLATFORM_ADDR=${platform.address}`);
console.log(`HARDCODED_CREATOR_ADDR=${creator.address}`);
