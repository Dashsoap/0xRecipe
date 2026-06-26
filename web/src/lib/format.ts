/** USDC has 6 decimals on Injective EVM testnet. */
const USDC_DECIMALS = 6;

/** Creator's share of each charge, in basis points (20%). Platform takes 80%. */
export const CREATOR_SHARE_BPS = 2000n;

/**
 * Creator's cut of one charge, in USDC base units. Integer math on BigInt so
 * there is no float drift. Non-numeric input yields "0" rather than throwing.
 */
export function creatorShareUnits(amountUnits: string): string {
  try {
    return ((BigInt(amountUnits) * CREATOR_SHARE_BPS) / 10000n).toString();
  } catch {
    return "0";
  }
}

/** Sum a list of base-unit strings into one base-unit string (BigInt). */
export function sumUnits(values: string[]): string {
  let total = 0n;
  for (const v of values) {
    try {
      total += BigInt(v);
    } catch {
      // Skip malformed entries rather than corrupt the running total.
    }
  }
  return total.toString();
}

/**
 * Format a USDC base-unit string (6 decimals) as a human dollar amount.
 * e.g. "50000" -> "$0.05". Avoids floating point on the integer part.
 */
export function formatUsdc(baseUnits: string): string {
  const negative = baseUnits.startsWith("-");
  const digits = (negative ? baseUnits.slice(1) : baseUnits).replace(
    /\D/g,
    "",
  );
  const padded = digits.padStart(USDC_DECIMALS + 1, "0");
  const whole = padded.slice(0, padded.length - USDC_DECIMALS);
  const frac = padded.slice(padded.length - USDC_DECIMALS);
  // Show at least 2 fractional digits, trim trailing zeros beyond that.
  const trimmed = frac.replace(/(\d{2})(\d*?)0*$/, "$1$2");
  return `${negative ? "-" : ""}$${whole}.${trimmed}`;
}

/** Shorten an address for display, e.g. 0x0000…110A. */
export function shortenAddress(address: string): string {
  if (address.length <= 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Shorten a tx hash for display. */
export function shortenHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 8)}…${hash.slice(-6)}`;
}

/** Relative time like "12s ago" / "3m ago" from a ms timestamp. */
export function timeAgo(timestampMs: number, nowMs: number = Date.now()): string {
  const diff = Math.max(0, nowMs - timestampMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}
