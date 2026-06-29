// Preflight: derive accounts from MNEMONIC (.env) and read on-chain state.
// Prints ONLY public addresses + balances + chain facts. Never prints the mnemonic.
// Run: cd backend && node --env-file=../.env scripts/preflight.mjs
import { mnemonicToAccount } from "viem/accounts";
import { createPublicClient, http, formatEther, formatUnits } from "viem";

const MNEMONIC = process.env.MNEMONIC;
const MOCK_CHAIN = process.env.MOCK_CHAIN === "1";
const MOCK_FUSION = process.env.MOCK_FUSION === "1";
if (!MNEMONIC) {
  console.error("MNEMONIC not set in .env (add: MNEMONIC=\"word1 ... word12\")");
  if (!MOCK_CHAIN) process.exit(1);
}

const USDC = process.env.USDC_ADDRESS || "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d";
const ESCROW = process.env.AGENT_ESCROW_ADDRESS;
const SPLITTER = process.env.FUSION_SPLITTER_ADDRESS;
const RPCS = [
  process.env.RPC_URL,
  "https://k8s.testnet.json-rpc.injective.network/",
  "https://1439.rpc.thirdweb.com",
].filter(Boolean);

const erc20 = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
];

console.log("Mock mode:");
console.log("  MOCK_CHAIN :", MOCK_CHAIN ? "ON (RPC signer/escrow writes mocked)" : "off");
console.log("  MOCK_FUSION:", MOCK_FUSION ? "ON (LLM calls mocked)" : "off");
console.log("\nConfig:");
console.log("  AGENT_ESCROW_ADDRESS   :", ESCROW || (MOCK_CHAIN ? "(not needed in mock chain)" : "MISSING"));
console.log("  FUSION_SPLITTER_ADDRESS:", SPLITTER || (MOCK_CHAIN ? "(not needed in mock chain)" : "MISSING"));
console.log("  LLM_GATEWAY_URL        :", process.env.LLM_GATEWAY_URL ? "present" : (MOCK_FUSION ? "(not needed in mock fusion)" : "MISSING"));
console.log("  LLM_GATEWAY_KEY        :", process.env.LLM_GATEWAY_KEY ? "present" : (MOCK_FUSION ? "(not needed in mock fusion)" : "MISSING"));
console.log("  LLM_GATEWAY_KEY_PURE   :", process.env.LLM_GATEWAY_KEY_PURE ? "present" : (MOCK_FUSION ? "(not needed in mock fusion)" : "MISSING"));

// derive roles from one seed when available
const roles = MNEMONIC
  ? [
      ["index0 (backend / deployer)", mnemonicToAccount(MNEMONIC, { addressIndex: 0 })],
      ["index1 (agent)", mnemonicToAccount(MNEMONIC, { addressIndex: 1 })],
      ["index2 (creator)", mnemonicToAccount(MNEMONIC, { addressIndex: 2 })],
      ["index3 (platform)", mnemonicToAccount(MNEMONIC, { addressIndex: 3 })],
    ]
  : [];

if (MOCK_CHAIN) {
  console.log("\nDerived accounts:");
  if (roles.length === 0) {
    console.log("  (MNEMONIC not set; no derived accounts to inspect)");
  } else {
    for (const [label, acct] of roles) {
      console.log(`  ${label.padEnd(28)} ${acct.address}`);
    }
  }
  console.log("\nMOCK_CHAIN=1, skipping RPC / balance / contract checks.");
  process.exit(0);
}

let client, rpcUsed;
for (const url of RPCS) {
  try {
    const c = createPublicClient({ transport: http(url) });
    await c.getChainId();
    client = c; rpcUsed = url; break;
  } catch { /* try next */ }
}
if (!client) { console.error("All RPCs unreachable:", RPCS); process.exit(1); }

const chainId = await client.getChainId();
console.log("RPC      :", rpcUsed);
console.log("chainId  :", chainId, chainId === 1439 ? "(Injective EVM testnet OK)" : "(WARN: expected 1439)");

let usdcName = "?", usdcDec = 6;
try {
  usdcName = await client.readContract({ address: USDC, abi: erc20, functionName: "name" });
  usdcDec = await client.readContract({ address: USDC, abi: erc20, functionName: "decimals" });
  console.log("USDC     :", USDC, `name="${usdcName}" decimals=${usdcDec}`);
} catch (e) {
  console.log("USDC read failed:", e.shortMessage || e.message);
}

console.log("\nDerived accounts (from your .env MNEMONIC):");
if (roles.length === 0) {
  console.log("  (MNEMONIC not set; no derived accounts to inspect)");
} else {
  for (const [label, acct] of roles) {
    const inj = await client.getBalance({ address: acct.address });
    let usdc = 0n;
    try { usdc = await client.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [acct.address] }); } catch {}
    console.log(`  ${label.padEnd(28)} ${acct.address}  INJ=${formatEther(inj)}  USDC=${formatUnits(usdc, usdcDec)}`);
  }
}
if (roles.length > 0) console.log("\n(Whichever index shows your faucet balance is the one you funded.)");
