import { describe, it, expect } from "vitest";
import { foldSystemIntoUser } from "../src/gateway.js";
import type { ChatMessage } from "../src/gateway.js";

/**
 * foldSystemIntoUser is the self-heal fallback for upstream channels that reject
 * a `system` role in `messages` (see gateway.ts). It must preserve every
 * instruction and the message order while removing the `system` role.
 */
describe("foldSystemIntoUser", () => {
  it("prepends the system text to the first user message and drops the system role", () => {
    const input: ChatMessage[] = [
      { role: "system", content: "You are a careful reviewer." },
      { role: "user", content: "Review this." },
    ];
    expect(foldSystemIntoUser(input)).toEqual([
      { role: "user", content: "You are a careful reviewer.\n\nReview this." },
    ]);
  });

  it("joins multiple system messages in order", () => {
    const input: ChatMessage[] = [
      { role: "system", content: "Rule A." },
      { role: "system", content: "Rule B." },
      { role: "user", content: "Go." },
    ];
    expect(foldSystemIntoUser(input)).toEqual([
      { role: "user", content: "Rule A.\n\nRule B.\n\nGo." },
    ]);
  });

  it("returns the messages unchanged when there is no system role", () => {
    const input: ChatMessage[] = [
      { role: "user", content: "Hello." },
      { role: "assistant", content: "Hi." },
    ];
    expect(foldSystemIntoUser(input)).toEqual(input);
  });

  it("only folds into the FIRST user message and preserves later turns", () => {
    const input: ChatMessage[] = [
      { role: "system", content: "Sys." },
      { role: "user", content: "First." },
      { role: "assistant", content: "Reply." },
      { role: "user", content: "Second." },
    ];
    expect(foldSystemIntoUser(input)).toEqual([
      { role: "user", content: "Sys.\n\nFirst." },
      { role: "assistant", content: "Reply." },
      { role: "user", content: "Second." },
    ]);
  });

  it("turns a leading system into a user message when no user turn exists", () => {
    const input: ChatMessage[] = [{ role: "system", content: "Only system." }];
    expect(foldSystemIntoUser(input)).toEqual([
      { role: "user", content: "Only system." },
    ]);
  });
});
