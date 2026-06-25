/**
 * EIP-3009 `ReceiveWithAuthorization` signing (C7).
 *
 * This is the on-chain authorization primitive for the no-registration,
 * gasless prefund: the agent signs an off-chain authorization, and a backend
 * relayer submits it so the escrow contract pulls USDC via
 * `usdc.receiveWithAuthorization(...)` with the contract itself as `msg.sender`
 * (= payee), which is the path that books the deposit to the signer.
 *
 * The signer (`walletClient` + `account`) is supplied by the caller. This
 * module never constructs a wallet, reads a private key, or touches the
 * environment — it only formats and signs the EIP-712 payload.
 */
import type { Account, Address, Hex, WalletClient } from "viem";
import { hexToBytes } from "viem";
import {
  CHAIN_ID,
  USDC_DOMAIN_NAME,
  USDC_DOMAIN_VERSION,
} from "./chain.js";

/** EIP-712 typed-data definition for `ReceiveWithAuthorization`. */
export const RECEIVE_WITH_AUTHORIZATION_TYPES = {
  ReceiveWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

/** Parameters for {@link signReceiveWithAuthorization}. */
export interface SignReceiveWithAuthorizationParams {
  /** Caller-supplied viem wallet client used to sign. */
  walletClient: WalletClient;
  /** Account that owns the funds and signs the authorization. */
  account: Account;
  /** Address of the USDC token (its proxy is the EIP-712 verifying contract). */
  usdcAddress: Address;
  /** Funds owner (must equal the signing account). */
  from: Address;
  /** Authorized payee (the escrow contract). */
  to: Address;
  /** Amount, in USDC smallest units. */
  value: bigint;
  /** Unix seconds after which the authorization becomes valid. */
  validAfter: bigint;
  /** Unix seconds before which the authorization is valid. */
  validBefore: bigint;
  /** Unique 32-byte nonce for replay protection. */
  nonce: Hex;
}

/** Result of signing a `ReceiveWithAuthorization` authorization. */
export interface SignedReceiveWithAuthorization {
  v: number;
  r: Hex;
  s: Hex;
  /** The packed 65-byte signature. */
  signature: Hex;
}

/**
 * Sign an EIP-3009 `ReceiveWithAuthorization` authorization for USDC.
 *
 * Returns both the packed `signature` and its `{v, r, s}` split so callers can
 * pass whichever form the contract entrypoint expects.
 */
export async function signReceiveWithAuthorization(
  params: SignReceiveWithAuthorizationParams,
): Promise<SignedReceiveWithAuthorization> {
  const {
    walletClient,
    account,
    usdcAddress,
    from,
    to,
    value,
    validAfter,
    validBefore,
    nonce,
  } = params;

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: USDC_DOMAIN_NAME,
      version: USDC_DOMAIN_VERSION,
      chainId: CHAIN_ID,
      verifyingContract: usdcAddress,
    },
    types: RECEIVE_WITH_AUTHORIZATION_TYPES,
    primaryType: "ReceiveWithAuthorization",
    message: { from, to, value, validAfter, validBefore, nonce },
  });

  return { ...splitSignature(signature), signature };
}

/** Split a packed 65-byte signature into its `{v, r, s}` components. */
function splitSignature(signature: Hex): { v: number; r: Hex; s: Hex } {
  const bytes = hexToBytes(signature);
  if (bytes.length !== 65) {
    throw new Error(
      `Expected a 65-byte signature, received ${bytes.length} bytes`,
    );
  }
  const r = `0x${toHex(bytes.slice(0, 32))}` as Hex;
  const s = `0x${toHex(bytes.slice(32, 64))}` as Hex;
  let v = bytes[64]!;
  // Normalize legacy recovery ids (0/1) to {27, 28}.
  if (v < 27) v += 27;
  return { v, r, s };
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}
