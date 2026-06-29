#!/usr/bin/env node
/**
 * Environment doctor. Prints only public config/address state, never secrets.
 *
 * Run:
 *   cd backend && node --env-file=../.env scripts/doctor.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import Database from "better-sqlite3";
import {
  createPublicClient,
  http,
  formatUnits,
  getAddress,
  defineChain,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";

const RPC = process.env.RPC_URL || "https://1439.rpc.thirdweb.com";
const USDC = process.env.USDC_ADDRESS || "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d";
const ESCROW = process.env.AGENT_ESCROW_ADDRESS;
const SPLITTER = process.env.FUSION_SPLITTER_ADDRESS;
const MOCK_CHAIN = process.env.MOCK_CHAIN === "1";
const MOCK_FUSION = process.env.MOCK_FUSION === "1";
const DB_PATH = process.env.DATABASE_PATH?.trim() || resolve(process.cwd(), "..", "data", "0xrecipe.db");

const chain = defineChain({
  id: 1439,
  name: "Injective EVM Testnet",
  nativeCurrency: { name: "Injective", symbol: "INJ", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const publicClient = createPublicClient({ chain, transport: http(RPC) });

const escrowAbi = [
  { type: "function", name: "backend", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "splitter", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
];

let failures = 0;
let warnings = 0;
function line(kind, label, detail = "") {
  const icon = kind === "pass" ? "PASS" : kind === "warn" ? "WARN" : "FAIL";
  if (kind === "warn") warnings += 1;
  if (kind === "fail") failures += 1;
  console.log(`${icon.padEnd(4)} ${label}${detail ? ` — ${detail}` : ""}`);
}

function signerAddress() {
  if (process.env.BACKEND_PRIVATE_KEY?.trim()) {
    const raw = process.env.BACKEND_PRIVATE_KEY.trim();
    return privateKeyToAccount(raw.startsWith("0x") ? raw : `0x${raw}`).address;
  }
  if (process.env.MNEMONIC?.trim()) {
    return mnemonicToAccount(process.env.MNEMONIC.trim(), { addressIndex: 0 }).address;
  }
  return null;
}

console.log("0xRecipe doctor\n");
line(MOCK_CHAIN ? "warn" : "pass", "MOCK_CHAIN", MOCK_CHAIN ? "ON; chain writes are mocked" : "off");
line(MOCK_FUSION ? "warn" : "pass", "MOCK_FUSION", MOCK_FUSION ? "ON; model calls are mocked" : "off");

const signer = signerAddress();
line(signer ? "pass" : "fail", "backend signer", signer || "missing BACKEND_PRIVATE_KEY or MNEMONIC");
line(ESCROW ? "pass" : MOCK_CHAIN ? "warn" : "fail", "AGENT_ESCROW_ADDRESS", ESCROW || "missing");
line(SPLITTER ? "pass" : MOCK_CHAIN ? "warn" : "fail", "FUSION_SPLITTER_ADDRESS", SPLITTER || "missing");

line(process.env.LLM_GATEWAY_URL || MOCK_FUSION ? "pass" : "fail", "LLM_GATEWAY_URL", process.env.LLM_GATEWAY_URL ? "present" : "missing");
line(process.env.LLM_GATEWAY_KEY || MOCK_FUSION ? "pass" : "fail", "LLM_GATEWAY_KEY", process.env.LLM_GATEWAY_KEY ? "present" : "missing");
line(process.env.LLM_GATEWAY_KEY_PURE || MOCK_FUSION ? "pass" : "fail", "LLM_GATEWAY_KEY_PURE", process.env.LLM_GATEWAY_KEY_PURE ? "present" : "missing");

if (!MOCK_CHAIN) {
  try {
    const chainId = await publicClient.getChainId();
    line(chainId === 1439 ? "pass" : "fail", "chainId", String(chainId));
  } catch (err) {
    line("fail", "RPC reachable", err.shortMessage || err.message);
  }

  for (const [label, address] of [["escrow code", ESCROW], ["splitter code", SPLITTER]]) {
    if (!address) continue;
    try {
      const code = await publicClient.getCode({ address });
      line(code && code !== "0x" ? "pass" : "fail", label, address);
    } catch (err) {
      line("fail", label, err.shortMessage || err.message);
    }
  }

  if (ESCROW && signer) {
    try {
      const onchainBackend = await publicClient.readContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "backend",
      });
      line(
        onchainBackend.toLowerCase() === signer.toLowerCase() ? "pass" : "fail",
        "AgentEscrow.backend()",
        `${onchainBackend} vs signer ${signer}`,
      );
    } catch (err) {
      line("fail", "AgentEscrow.backend()", err.shortMessage || err.message);
    }
  }

  if (ESCROW && SPLITTER) {
    try {
      const onchainSplitter = await publicClient.readContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "splitter",
      });
      line(
        onchainSplitter.toLowerCase() === SPLITTER.toLowerCase() ? "pass" : "fail",
        "AgentEscrow.splitter()",
        `${onchainSplitter} vs env ${SPLITTER}`,
      );
    } catch (err) {
      line("fail", "AgentEscrow.splitter()", err.shortMessage || err.message);
    }
  }

  const agent = process.env.NEXT_PUBLIC_DEMO_AGENT ||
    (process.env.MNEMONIC?.trim()
      ? mnemonicToAccount(process.env.MNEMONIC.trim(), { addressIndex: 1 }).address
      : "");
  if (ESCROW && agent) {
    try {
      const bal = await publicClient.readContract({
        address: ESCROW,
        abi: escrowAbi,
        functionName: "balanceOf",
        args: [getAddress(agent)],
      });
      line(bal > 0n ? "pass" : "warn", "agent escrow balance", `${formatUnits(bal, 6)} USDC (${agent})`);
    } catch (err) {
      line("fail", "agent escrow balance", err.shortMessage || err.message);
    }
  }
}

if (existsSync(DB_PATH)) {
  const db = new Database(DB_PATH, { readonly: true });
  try {
    const row = db.prepare(
      "SELECT id, price_usdc, creator_address FROM recipes WHERE id = ?",
    ).get("legal-reviewer-v1");
    if (row) {
      line("pass", "recipe legal-reviewer-v1", `${row.price_usdc} USDC creator=${row.creator_address}`);
    } else {
      line("warn", "recipe legal-reviewer-v1", "not seeded");
    }
  } finally {
    db.close();
  }
} else {
  line("warn", "recipe DB", `${DB_PATH} does not exist; start backend once to seed`);
}

try {
  const dep = JSON.parse(readFileSync(new URL("../../contracts/deployments/injective-testnet-1439.json", import.meta.url), "utf8"));
  line(dep.agentEscrow === ESCROW ? "pass" : "warn", "deployment JSON escrow", dep.agentEscrow);
  line(dep.fusionSplitter === SPLITTER ? "pass" : "warn", "deployment JSON splitter", dep.fusionSplitter);
} catch (err) {
  line("warn", "deployment JSON", err.message);
}

console.log(`\nSummary: ${failures} failure(s), ${warnings} warning(s)`);
process.exit(failures > 0 ? 1 : 0);
