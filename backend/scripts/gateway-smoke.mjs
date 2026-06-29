#!/usr/bin/env node
/**
 * Minimal OpenAI-compatible gateway smoke test. Prints no keys.
 *
 * Run:
 *   cd backend && node --env-file=../.env scripts/gateway-smoke.mjs
 */
const GW = (process.env.LLM_GATEWAY_URL || "").replace(/\/$/, "");
const STANDARD = process.env.LLM_GATEWAY_KEY;
const OFFICIAL = process.env.LLM_GATEWAY_KEY_PURE;

if (!GW || !STANDARD || !OFFICIAL) {
  console.error("Missing LLM_GATEWAY_URL / LLM_GATEWAY_KEY / LLM_GATEWAY_KEY_PURE.");
  process.exit(1);
}

async function call(label, key, model, bodyExtra = {}) {
  const res = await fetch(`${GW}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 16,
      ...bodyExtra,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} ${model} -> ${res.status}: ${text.slice(0, 300)}`);
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${label} ${model} returned non-JSON: ${text.slice(0, 160)}`);
  }
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error(`${label} ${model} returned unexpected shape`);
  }
  console.log(`PASS ${label.padEnd(8)} ${model}: ${content.slice(0, 80).replace(/\s+/g, " ")}`);
}

try {
  await call("standard", STANDARD, "gpt-5.5", {
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "smoke",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
        },
      },
    },
    messages: [{ role: "user", content: "{\"ok\":true}" }],
  });
  await call("official", OFFICIAL, "claude-opus-4-8");
  console.log("Gateway smoke passed.");
} catch (err) {
  console.error(`FAIL ${err.message}`);
  process.exit(1);
}
