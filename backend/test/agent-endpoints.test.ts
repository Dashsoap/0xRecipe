import { describe, it, expect, beforeAll, vi } from "vitest";
import { formatUnits, getAddress } from "viem";

// Mock the on-chain escrow so NO chain is touched: readBalance / relayDeposit
// are controllable, charge is unused here. vi.hoisted lifts the mock fns above
// the hoisted vi.mock factory so the factory can reference them.
const { readBalanceMock, relayDepositMock } = vi.hoisted(() => ({
  readBalanceMock: vi.fn(),
  relayDepositMock: vi.fn(),
}));

vi.mock("../src/escrow.js", () => ({
  readBalance: readBalanceMock,
  relayDeposit: relayDepositMock,
  charge: vi.fn(),
}));

const ESCROW_ADDRESS = "0x000000000000000000000000000000000000bEEF";
// Configure the escrow address BEFORE the app (hence config.ts) is imported, so
// /v1/deposit/info sees a configured escrow. The app is imported dynamically in
// beforeAll for exactly this reason — a static import would evaluate config.ts
// before this assignment runs.
process.env.AGENT_ESCROW_ADDRESS = ESCROW_ADDRESS;

const DUMMY_TX = `0x${"cd".repeat(32)}` as `0x${string}`;

let app: (typeof import("../src/index.js"))["app"];
let insertLedgerEntry: (typeof import("../src/db.js"))["insertLedgerEntry"];

beforeAll(async () => {
  // Both dynamic imports share this test file's isolated module registry, so the
  // db singleton the route writes to is the same one this helper writes to.
  ({ app } = await import("../src/index.js"));
  ({ insertLedgerEntry } = await import("../src/db.js"));
});

describe("agent self-serve endpoints", () => {
  it("GET /v1/balance/:agent returns the mocked balance, formatted", async () => {
    readBalanceMock.mockResolvedValue(1_500_000n);
    const agent = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

    const res = await app.fetch(
      new Request(`http://localhost/v1/balance/${agent}`),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      agent: string;
      balanceUnits: string;
      balanceUsdc: string;
    };
    expect(body.agent).toBe(getAddress(agent));
    expect(body.balanceUnits).toBe("1500000");
    expect(body.balanceUsdc).toBe(formatUnits(1_500_000n, 6)); // "1.5"
  });

  it("GET /v1/balance/:agent rejects an invalid address with 400", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/balance/not-an-address"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_agent");
  });

  it("GET /v1/deposit/info returns the escrow, usdc, and signing domain", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/deposit/info"),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      chainId: number;
      escrowAddress: string;
      usdcAddress: string;
      primaryType: string;
      domain: {
        name: string;
        version: string;
        chainId: number;
        verifyingContract: string;
      };
      types: Record<string, unknown>;
    };
    expect(body.escrowAddress).toBe(ESCROW_ADDRESS);
    expect(body.chainId).toBe(1439);
    expect(body.usdcAddress).toBeTruthy();
    expect(body.primaryType).toBe("ReceiveWithAuthorization");
    expect(body.domain.name).toBe("USDC");
    expect(body.domain.version).toBe("2");
    expect(body.domain.chainId).toBe(1439);
    expect(body.domain.verifyingContract).toBe(body.usdcAddress);
    expect(body.types.ReceiveWithAuthorization).toBeDefined();
  });

  it("POST /v1/deposit relays, returns the new balance, and records a ledger row that /v1/usage returns", async () => {
    const agent = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
    relayDepositMock.mockResolvedValue(DUMMY_TX);
    readBalanceMock.mockResolvedValue(2_000_000n);

    const res = await app.fetch(
      new Request("http://localhost/v1/deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: agent,
          value: "1000000",
          validAfter: "0",
          validBefore: "9999999999",
          nonce: `0x${"11".repeat(32)}`,
          v: 27,
          r: `0x${"22".repeat(32)}`,
          s: `0x${"33".repeat(32)}`,
        }),
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      txHash: string;
      balanceUnits: string;
      balanceUsdc: string;
    };
    expect(body.txHash).toBe(DUMMY_TX);
    expect(body.balanceUnits).toBe("2000000");
    expect(body.balanceUsdc).toBe(formatUnits(2_000_000n, 6)); // "2"
    expect(relayDepositMock).toHaveBeenCalledOnce();

    // The confirmed deposit now shows up in the agent's usage log.
    const usageRes = await app.fetch(
      new Request(`http://localhost/v1/usage/${agent}`),
    );
    expect(usageRes.status).toBe(200);
    const usage = (await usageRes.json()) as {
      agent: string;
      entries: Array<Record<string, unknown>>;
    };
    expect(usage.entries).toHaveLength(1);
    expect(usage.entries[0]).toMatchObject({
      type: "deposit",
      amountUnits: "1000000",
      amountUsdc: "1",
      recipeId: null,
      counterparty: null,
      txHash: DUMMY_TX,
    });
  });

  it("POST /v1/deposit rejects a malformed nonce with 400", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          from: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
          value: "1000000",
          validAfter: "0",
          validBefore: "9999999999",
          nonce: "0x1234", // too short — not 32 bytes
          v: 27,
          r: `0x${"22".repeat(32)}`,
          s: `0x${"33".repeat(32)}`,
        }),
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_deposit");
  });

  it("POST /v1/deposit rejects a non-object body (JSON null) with 400", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/deposit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "null", // valid JSON, but not an object
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string; message?: string };
    expect(body.error).toBe("invalid_deposit");
    expect(body.message).toBe("Request body must be a JSON object.");
  });

  it("GET /v1/usage/:agent reflects a recorded charge too", async () => {
    const agent = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
    const creator = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";
    insertLedgerEntry({
      ts: Date.now(),
      agent,
      type: "charge",
      amountUnits: "50000",
      amountUsdc: formatUnits(50_000n, 6),
      recipeId: "legal-reviewer-v1",
      counterparty: creator,
      txHash: DUMMY_TX,
    });

    const res = await app.fetch(
      new Request(`http://localhost/v1/usage/${agent}`),
    );
    expect(res.status).toBe(200);
    const usage = (await res.json()) as {
      entries: Array<Record<string, unknown>>;
    };
    expect(usage.entries).toHaveLength(1);
    expect(usage.entries[0]).toMatchObject({
      type: "charge",
      amountUnits: "50000",
      amountUsdc: "0.05",
      recipeId: "legal-reviewer-v1",
      counterparty: creator,
      txHash: DUMMY_TX,
    });
  });

  it("GET /v1/usage/:agent rejects an invalid address with 400", async () => {
    const res = await app.fetch(
      new Request("http://localhost/v1/usage/nope"),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid_agent");
  });
});
