# 0xRecipe Contracts

On-chain settlement for the 0xRecipe model market on Injective EVM testnet (chainId 1439). An agent prepays USDC into escrow once; every model call is charged against that locked balance, and each charge atomically forwards the fee and splits it 80/20 between the creator and the platform in a single transaction.

## Contracts

| Contract | Responsibility |
|---|---|
| `src/AgentEscrow.sol` | Prepaid escrow. Agents deposit USDC gaslessly via EIP-3009 `receiveWithAuthorization` (credited to the signer, submitted by a relayer). The authorized backend charges per call; charging debits the balance and triggers the split atomically. Agents withdraw unspent balance anytime. |
| `src/FusionPayoutSplitter.sol` | Reads its own USDC balance and pays 80% to the creator, 20% to the platform. A zero balance is a no-op (no revert). Also emits an audit event for off-chain accounting. |
| `src/interfaces/IERC20.sol` | Minimal ERC-20 surface used by the contracts. |
| `src/interfaces/IERC3009.sol` | Minimal EIP-3009 `receiveWithAuthorization` surface. |
| `src/utils/ReentrancyGuard.sol` | Minimal non-reentrancy lock. |

All interface/guard implementations are intentionally minimal (hand-written) so the project carries no external dependency beyond `forge-std` for tests. For production, swap in audited OpenZeppelin equivalents.

### Why `receiveWithAuthorization` (not `transferWithAuthorization`)

Deposits MUST use EIP-3009 `receiveWithAuthorization`. That variant enforces `msg.sender == to`, so when `AgentEscrow.depositFor` calls it, the escrow is the payee and the funds are pulled in through the escrow's accounting hook — crediting the signer `from`. `transferWithAuthorization` to a contract would land the funds at the escrow but bypass that hook, so the money would arrive un-credited. See `IMPLEMENTATION_PLAN` §1.5 (C11 / R1).

### Settlement flow

```
deposit (once)  : relayer submits agent's EIP-3009 signature -> balances[agent] += value
charge (per call): backend -> require balance -> debit -> transfer to splitter -> split 80/20   (one atomic tx)
withdraw (anytime): agent -> require balance -> debit -> transfer back
```

Security posture: `ReentrancyGuard` on every fund-moving path, strict checks-effects-interactions, and `onlyBackend` on `charge`. The escrow custodies agent funds between deposit and withdraw; the backend hot wallet is the only address allowed to charge, and every charge emits an on-chain `Charged` event for auditability.

## Test

```bash
forge test -vvv
```

Tests live in `test/`. `MockUSDC.sol` is a 6-decimal USDC stand-in with a real EIP-712 `receiveWithAuthorization`, mirroring the testnet USDC domain (`name="USDC"`, `version="2"`, `chainId=block.chainid`). Coverage includes:

- `testDepositRecordsToSigner` — deposit credits the signer, never the relayer
- `testChargeSplits8020` — deposit 0.10, charge 0.05 -> creator 0.04 / platform 0.01 / escrow 0.05
- `testDistributeZeroBalanceNoRevert` — empty splitter `distribute` is a no-op
- `testWithdraw` / `testChargeOnlyBackend` / `testChargeInsufficientReverts` / `testWithdrawInsufficientReverts`
- `testReentrancyGuard` — a malicious re-entrant splitter is blocked by `nonReentrant`

> `forge-std` is installed during the verification stage (`forge install foundry-rs/forge-std`); it is not vendored here.

## Build / toolchain

- Solidity `0.8.28`, `evm_version=cancun`, optimizer on (200 runs). See `foundry.toml`.

## Deploy (prerequisites — not run at this stage)

Deployment is intentionally deferred. When ready:

1. Provide environment variables (never commit secrets):
   - `PRIVATE_KEY` — deployer key
   - `USDC_ADDRESS` — testnet USDC (reference value `0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d`)
   - `BACKEND` — backend hot wallet authorized to call `charge`
   - `PLATFORM` — platform payout address
   - `RPC_URL` — `https://k8s.testnet.json-rpc.injective.network/`
2. Run:
   ```bash
   forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
   ```
3. Record the deployed `AgentEscrow` and `FusionPayoutSplitter` addresses into the backend environment.

`script/Deploy.s.sol` reads all addresses from the environment and hardcodes no keys or real addresses.
