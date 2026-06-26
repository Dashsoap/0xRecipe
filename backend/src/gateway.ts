/**
 * Unified model gateway client.
 *
 * The backend does NOT integrate each vendor's official SDK directly. Instead
 * every model call goes through a single OpenAI-compatible `base_url`. This
 * keeps the call site uniform regardless of which model is requested.
 *
 * Channel is a first-class concept: the same model can be supplied by different
 * channels at different quality / price tiers. We pick the API key per channel:
 *   - "standard" -> LLM_GATEWAY_KEY
 *   - "official" -> LLM_GATEWAY_KEY_PURE
 *
 * Naming note: the internal enum uses "standard" / "official". Any text that
 * can reach a user must only say "standard source" / "official source" — never
 * the gateway product name or any internal codeword.
 */

import OpenAI from "openai";
import { config, requireEnv } from "./config.js";

export type Channel = "standard" | "official";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Optional structured-output request. When the gateway forwards JSON Schema
 * strict mode, the model is constrained to the given schema. Callers must still
 * tolerate gateways that ignore this (see fusion.ts robust parsing).
 */
export interface JsonSchemaResponseFormat {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
}

export interface CallModelParams {
  channel: Channel;
  model: string;
  messages: ChatMessage[];
  responseFormat?: JsonSchemaResponseFormat;
  stream?: boolean;
  temperature?: number;
}

/** Resolve the API key for a channel; fail fast (no fake key) if unset. */
function keyForChannel(channel: Channel): string {
  if (channel === "official") {
    requireEnv(["llmGatewayKeyPure"]);
    return config.llmGatewayKeyPure as string;
  }
  requireEnv(["llmGatewayKey"]);
  return config.llmGatewayKey as string;
}

/**
 * Per-call gateway timeout (ms). A hung/slow upstream socket is cut here rather
 * than blocking a paid call on the SDK's 10-minute default. The SDK already
 * retries transient failures (connection errors, 408/409/429, >=500) and
 * timeouts up to `maxRetries` with backoff — that is the resilience layer for a
 * flaky gateway. Cross-channel fallback is intentionally NOT done: the shipped
 * recipe maps each model to a single channel, so there is no same-model target
 * on the other channel to fall back to (left to a future multi-channel recipe).
 */
const GATEWAY_TIMEOUT_MS = 45_000;
/** Bounded retries on transient (connection/408/409/429/5xx) and timeout failures. */
const GATEWAY_MAX_RETRIES = 2;

function clientForChannel(channel: Channel): OpenAI {
  return new OpenAI({
    baseURL: config.llmGatewayUrl,
    apiKey: keyForChannel(channel),
    timeout: GATEWAY_TIMEOUT_MS,
    maxRetries: GATEWAY_MAX_RETRIES,
  });
}

/**
 * Some upstream channels behind the gateway (notably certain Anthropic routes)
 * reject a `system` role inside `messages` and demand a top-level system
 * parameter the OpenAI wire format cannot express. The gateway load-balances a
 * model across such channels, so the same request succeeds on one channel and
 * 400s on another. Detect that specific 400 so we can self-heal by folding the
 * system text into the first user message and retrying. Not retried by the SDK
 * (400 is a client error), so we handle it ourselves.
 */
function isSystemPlacementError(err: unknown): boolean {
  return (
    err instanceof OpenAI.APIError &&
    err.status === 400 &&
    typeof err.message === "string" &&
    /top-level 'system'|system parameter|use the top-level/i.test(err.message)
  );
}

/**
 * Fold all `system` messages into the first user message, preserving order and
 * content, so a channel that refuses a `system` role still receives the full
 * instruction. Quality impact is minor; only used as a fallback on the specific
 * 400 above (channels that accept `system` keep the original shape).
 */
export function foldSystemIntoUser(messages: ChatMessage[]): ChatMessage[] {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  if (!system) return messages;
  const rest = messages.filter((m) => m.role !== "system");
  const firstUser = rest.findIndex((m) => m.role === "user");
  if (firstUser === -1) {
    return [{ role: "user", content: system }, ...rest];
  }
  return rest.map((m, i) =>
    i === firstUser ? { ...m, content: `${system}\n\n${m.content}` } : m,
  );
}

/**
 * Non-streaming call: returns the assistant text of the first choice.
 * Throws on transport / auth errors — callers must not fabricate a result.
 */
export async function callModel(
  params: CallModelParams & { stream?: false },
): Promise<string>;
/**
 * Streaming call: returns the raw chunk stream so the caller can forward SSE.
 */
export async function callModel(
  params: CallModelParams & { stream: true },
): Promise<AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>>;
export async function callModel(
  params: CallModelParams,
): Promise<string | AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>> {
  const client = clientForChannel(params.channel);

  const base: OpenAI.Chat.Completions.ChatCompletionCreateParams = {
    model: params.model,
    messages: params.messages,
    ...(params.temperature !== undefined ? { temperature: params.temperature } : {}),
    ...(params.responseFormat ? { response_format: params.responseFormat } : {}),
  };

  if (params.stream) {
    return client.chat.completions.create({ ...base, stream: true });
  }

  let completion;
  try {
    completion = await client.chat.completions.create({ ...base, stream: false });
  } catch (err) {
    // Self-heal the cross-channel `system`-placement 400 (see helper above):
    // retry once with the system text folded into the first user message.
    if (isSystemPlacementError(err)) {
      completion = await client.chat.completions.create({
        ...base,
        messages: foldSystemIntoUser(params.messages),
        stream: false,
      });
    } else {
      throw err;
    }
  }
  const content = completion.choices[0]?.message?.content;
  if (content == null) {
    // User-safe message only: never interpolate the raw model id — this Error
    // reaches the caller via the route's error path. The model id goes to logs.
    throw new Error(`The ${labelForChannel(params.channel)} returned no content.`);
  }
  return content;
}

/**
 * User-facing label for a channel. The only words allowed in front of a user:
 * "standard source" / "official source".
 */
export function labelForChannel(channel: Channel): string {
  return channel === "official" ? "official source" : "standard source";
}
