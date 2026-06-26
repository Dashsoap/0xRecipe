/**
 * Public runtime config for the live demo dashboard.
 *
 * Every value here is non-sensitive public infrastructure (HTTP base, event
 * stream URL, a public agent address). All are overridable via NEXT_PUBLIC_*
 * env with localhost defaults, so the dashboard talks to a local backend out
 * of the box and can be pointed at a deployed one without code changes.
 */

/** Backend HTTP base — used for balance / usage reads. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:3001";

/** Server-sent settlement event stream. Defaults to API_BASE + /events/stream. */
export const EVENTS_URL =
  process.env.NEXT_PUBLIC_EVENTS_URL ?? `${API_BASE}/events/stream`;

/**
 * A clearly non-real zero address, shown only when no agent is configured so
 * the Agent pane never invents a wallet. The UI labels it as pending config.
 */
export const PLACEHOLDER_AGENT =
  "0x0000000000000000000000000000000000000000" as const;

const RAW_DEMO_AGENT = process.env.NEXT_PUBLIC_DEMO_AGENT;

/** Whether a real agent address was configured (vs. the zero placeholder). */
export const DEMO_AGENT_IS_SET = Boolean(RAW_DEMO_AGENT);

/** Agent whose escrow balance the Agent pane reads. */
export const DEMO_AGENT = RAW_DEMO_AGENT ?? PLACEHOLDER_AGENT;

/** Build the escrow-balance read URL for an agent address. */
export function balanceUrl(agent: string): string {
  return `${API_BASE}/v1/balance/${agent}`;
}
