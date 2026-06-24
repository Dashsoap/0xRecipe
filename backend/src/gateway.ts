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

function clientForChannel(channel: Channel): OpenAI {
  return new OpenAI({
    baseURL: config.llmGatewayUrl,
    apiKey: keyForChannel(channel),
  });
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

  const completion = await client.chat.completions.create({ ...base, stream: false });
  const content = completion.choices[0]?.message?.content;
  if (content == null) {
    throw new Error(
      `Model "${params.model}" returned no content via ${labelForChannel(params.channel)}.`,
    );
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
