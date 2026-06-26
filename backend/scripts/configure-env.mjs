// Idempotently upsert NON-SECRET config into repo-root .env. Never touches or
// prints MNEMONIC / gateway keys. platform/creator derived from MNEMONIC.
// Run: cd backend && node --env-file=../.env scripts/configure-env.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { mnemonicToAccount } from "viem/accounts";

const ENV_PATH = new URL("../../.env", import.meta.url);
let content = readFileSync(ENV_PATH, "utf8");

const M = process.env.MNEMONIC;
if (!M) { console.error("MNEMONIC missing in .env — add it first"); process.exit(1); }
const creator = mnemonicToAccount(M, { addressIndex: 2 }).address;  // HARDCODED_CREATOR_ADDR
const platform = mnemonicToAccount(M, { addressIndex: 3 }).address; // PLATFORM_ADDR

// thirdweb RPC by default: the k8s public RPC serves eth_getTransactionReceipt unreliably.
const SET = {
  RPC_URL: "https://1439.rpc.thirdweb.com",
  CHAIN_ID: "1439",
  USDC_ADDRESS: "0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d",
  PLATFORM_ADDR: platform,
  HARDCODED_CREATOR_ADDR: creator,
  VOUCHER_DOMAIN: "0xRecipe",
  RECIPE_PRICE_USDC: "0.05", // PROVISIONAL demo price — recompute against real gateway cost (D6)
};

const upsert = (c, k, v) => {
  const re = new RegExp(`^${k}=.*$`, "m");
  return re.test(c) ? c.replace(re, `${k}=${v}`) : `${c.replace(/\s*$/, "")}\n${k}=${v}\n`;
};
for (const [k, v] of Object.entries(SET)) content = upsert(content, k, v);
if (!content.endsWith("\n")) content += "\n";
writeFileSync(ENV_PATH, content);

const has = (k) => new RegExp(`^${k}=.+$`, "m").test(content);
console.log("Set (non-secret config, values shown — all public):");
for (const [k, v] of Object.entries(SET)) console.log(`  ${k}=${v}`);
console.log("\nSecrets — left untouched, values NOT shown:");
for (const k of ["MNEMONIC", "LLM_GATEWAY_URL", "LLM_GATEWAY_KEY", "LLM_GATEWAY_KEY_PURE"]) {
  console.log(`  ${k}: ${has(k) ? "present ✓" : "MISSING ✗"}`);
}
console.log("\nContract addresses — filled on (re)deploy:");
for (const k of ["AGENT_ESCROW_ADDRESS", "FUSION_SPLITTER_ADDRESS"]) {
  console.log(`  ${k}: ${has(k) ? "present (will be overwritten on 20/80 redeploy)" : "not set yet"}`);
}
