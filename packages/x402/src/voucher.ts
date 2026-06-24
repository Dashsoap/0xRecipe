/**
 * Per-call payment voucher (C10).
 *
 * Each call carries an EIP-712 voucher the agent signs and puts in the
 * `PAYMENT-SIGNATURE` header. The backend recovers the signer to prove the
 * caller controls the paying wallet, which stops anyone from spending another
 * agent's escrow balance just by naming its address. The voucher is what makes
 * the hot path honest/anti-impersonation; it defers (not removes) the
 * on-chain settlement.
 *
 * The signer (`walletClient` + `account`) is supplied by the caller. This
 * module never constructs a wallet, reads a private key, or touches the
 * environment.
 */
import type { Account, Address, Hex, WalletClient } from "viem";
import { recoverTypedDataAddress } from "viem";
import { CHAIN_ID } from "./chain.js";

/** EIP-712 domain for 0xRecipe per-call vouchers. */
export const VOUCHER_DOMAIN = {
  name: "0xRecipe",
  version: "1",
  chainId: CHAIN_ID,
} as const;

/** EIP-712 typed-data definition for {@link PaymentVoucher}. */
export const PAYMENT_VOUCHER_TYPES = {
  PaymentVoucher: [
    { name: "agent", type: "address" },
    { name: "recipeId", type: "string" },
    { name: "maxPrice", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

/** A single-call payment authorization signed by the paying agent. */
export interface PaymentVoucher {
  /** Paying agent address (must match the recovered signer). */
  agent: Address;
  /** Recipe being invoked. */
  recipeId: string;
  /** Maximum price the agent authorizes for this call, in USDC smallest units. */
  maxPrice: bigint;
  /** Per-agent monotonic nonce for replay protection. */
  nonce: bigint;
  /** Unix seconds after which the voucher is no longer accepted. */
  expiry: bigint;
}

/** Parameters for {@link signVoucher}. */
export interface SignVoucherParams {
  /** Caller-supplied viem wallet client used to sign. */
  walletClient: WalletClient;
  /** Account that pays and signs the voucher. */
  account: Account;
  /** The voucher to sign. */
  voucher: PaymentVoucher;
}

/** Parameters for {@link verifyVoucher}. */
export interface VerifyVoucherParams {
  /** The voucher whose signer is being checked. */
  voucher: PaymentVoucher;
  /** The signature produced by {@link signVoucher}. */
  signature: Hex;
}

/** Sign a {@link PaymentVoucher}, returning the packed signature. */
export async function signVoucher(params: SignVoucherParams): Promise<Hex> {
  const { walletClient, account, voucher } = params;
  return walletClient.signTypedData({
    account,
    domain: VOUCHER_DOMAIN,
    types: PAYMENT_VOUCHER_TYPES,
    primaryType: "PaymentVoucher",
    message: voucher,
  });
}

/**
 * Recover the signer of a {@link PaymentVoucher} and confirm it matches
 * `voucher.agent`.
 *
 * Returns the recovered address and a `valid` flag. Callers should additionally
 * reject expired vouchers and replayed nonces.
 */
export async function verifyVoucher(
  params: VerifyVoucherParams,
): Promise<{ valid: boolean; signer: Address }> {
  const { voucher, signature } = params;
  const signer = await recoverTypedDataAddress({
    domain: VOUCHER_DOMAIN,
    types: PAYMENT_VOUCHER_TYPES,
    primaryType: "PaymentVoucher",
    message: voucher,
    signature,
  });
  return {
    valid: signer.toLowerCase() === voucher.agent.toLowerCase(),
    signer,
  };
}
