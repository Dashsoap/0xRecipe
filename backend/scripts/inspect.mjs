// Read-only chain inspection: find what the deployer has already deployed,
// independent of flaky eth_getTransactionReceipt (uses nonce -> CREATE address -> getCode).
import { createPublicClient, http, getContractAddress } from "viem";
import { mnemonicToAccount } from "viem/accounts";

const M = process.env.MNEMONIC;
const deployer = mnemonicToAccount(M, { addressIndex: 0 }).address;

const RPCS = [
  "https://1439.rpc.thirdweb.com",
  "https://k8s.testnet.json-rpc.injective.network/",
  "https://injective-testnet-jsonrpc.publicnode.com",
];
const HASHES = [
  "0xde36ef1c3ac469a65feebb28d8232b6d5dd752298aa95b85cf5ca939b36d6ed3",
  "0x3db3dff7e3fb76a67efdc2d335e4479f3c5c94f242d644ae138321beb627e502",
];

console.log("deployer:", deployer, "\n");
for (const url of RPCS) {
  try {
    const c = createPublicClient({ transport: http(url) });
    const cid = await c.getChainId();
    const nonceLatest = await c.getTransactionCount({ address: deployer, blockTag: "latest" });
    const noncePending = await c.getTransactionCount({ address: deployer, blockTag: "pending" });
    console.log(`RPC ${url}\n  chainId=${cid} nonce(latest)=${nonceLatest} nonce(pending)=${noncePending}`);
    // Parallelize the per-nonce getCode probes (serial loop is slow + rate-limit prone).
    const maxNonce = Math.max(nonceLatest, noncePending);
    const rows = await Promise.all(
      Array.from({ length: maxNonce + 1 }, async (_, n) => {
        const addr = getContractAddress({ from: deployer, nonce: BigInt(n) });
        let len = 0;
        try { const code = await c.getCode({ address: addr }); len = code ? (code.length - 2) / 2 : 0; } catch {}
        return { n, addr, len };
      }),
    );
    for (const { n, addr, len } of rows) {
      if (len > 0) console.log(`  nonce ${n} -> ${addr}  codeLen=${len}  <-- DEPLOYED`);
      else console.log(`  nonce ${n} -> ${addr}  (no code)`);
    }
    for (const h of HASHES) {
      try { const r = await c.getTransactionReceipt({ hash: h }); console.log(`  receipt ${h.slice(0, 12)}.. status=${r?.status} addr=${r?.contractAddress}`); }
      catch (e) { console.log(`  receipt ${h.slice(0, 12)}.. ERR ${e.shortMessage || e.message}`); }
    }
    console.log();
  } catch (e) { console.log(`RPC ${url} FAIL: ${e.shortMessage || e.message}\n`); }
}
