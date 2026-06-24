# @0xrecipe/x402

Reusable on-chain signing primitives for 0xRecipe's payment hot path. Two
independent EIP-712 building blocks, plus the Injective EVM testnet chain
config they share.

This package only formats and signs typed data. Every signing function takes a
caller-supplied `walletClient` and `account` — it never constructs a wallet,
reads a private key, or touches the environment. Keys live in the caller's
config and are passed in explicitly.

## What's inside

### `chain`

Injective EVM testnet (`chainId 1439`) defined with viem's `defineChain`, plus
the USDC EIP-712 domain constants (`name = "USDC"`, `version = "2"`) and the
**testnet** USDC proxy address. Sign-time best practice is to confirm the
domain against the token's on-chain `name()` / `DOMAIN_SEPARATOR()` first.

### `eip3009` — gasless prefund authorization

`signReceiveWithAuthorization(...)` signs an EIP-3009 `ReceiveWithAuthorization`
for USDC, returning both the packed `signature` and its `{ v, r, s }` split.
This is the authorization a relayer submits so the escrow contract pulls USDC
as the payee (the path that books the deposit to the signer, not the relayer).

### `voucher` — per-call payment voucher

`signVoucher(...)` / `verifyVoucher(...)` sign and recover an EIP-712
`PaymentVoucher { agent, recipeId, maxPrice, nonce, expiry }` under the
`0xRecipe` domain. The voucher proves the caller controls the paying wallet, so
a balance cannot be spent by anyone who merely knows the agent's address. It
travels in the `PAYMENT-SIGNATURE` header. Callers must additionally reject
expired vouchers and replayed nonces.

## Usage

```ts
import {
  injectiveTestnet,
  TESTNET_USDC_ADDRESS,
  signReceiveWithAuthorization,
  signVoucher,
  verifyVoucher,
} from "@0xrecipe/x402";

// agent side: authorize a prefund (relayer submits it on-chain)
const auth = await signReceiveWithAuthorization({
  walletClient,
  account,
  usdcAddress: TESTNET_USDC_ADDRESS,
  from: agentAddress,
  to: escrowAddress,
  value: 1_000_000n, // USDC smallest units
  validAfter: 0n,
  validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600),
  nonce: randomNonce, // unique 32-byte hex
});

// agent side: sign a per-call voucher
const signature = await signVoucher({
  walletClient,
  account,
  voucher: { agent: agentAddress, recipeId, maxPrice, nonce, expiry },
});

// backend side: confirm the caller controls the paying wallet
const { valid, signer } = await verifyVoucher({ voucher, signature });
```
