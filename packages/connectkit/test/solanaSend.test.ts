import { ComputeBudgetProgram, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import {
  estimatePriorityFeeMicroLamports,
  isSolanaTransactionExpiredError,
  pickPriorityFeeMicroLamports,
  priorityFeeInstructions,
  rebroadcastUntilConfirmed,
  SOLANA_PRIORITY_FEE_DEFAULT_MICROLAMPORTS,
  SOLANA_PRIORITY_FEE_MAX_MICROLAMPORTS,
  SOLANA_PRIORITY_FEE_MIN_MICROLAMPORTS,
  SolanaTransactionExpiredError,
} from "../src/payment/solanaSend";

const SIG = "5igTestSignature";
const RAW = new Uint8Array([1, 2, 3]);

type Status = { err: unknown; confirmationStatus?: string } | null;

/**
 * Fake RPC: `statuses` is consumed one per regular poll; `heights` one per
 * block-height poll; `historyStatus` answers the final full-history lookup.
 */
function fakeConnection(opts: {
  statuses?: Status[];
  heights?: number[];
  historyStatus?: Status;
  firstSendError?: Error;
}) {
  const statuses = [...(opts.statuses ?? [])];
  const heights = [...(opts.heights ?? [])];
  let sends = 0;
  const conn = {
    sendRawTransaction: vi.fn(async (_raw: Uint8Array, o: any) => {
      sends++;
      if (sends === 1 && opts.firstSendError) throw opts.firstSendError;
      return SIG;
    }),
    getSignatureStatuses: vi.fn(async (_sigs: string[], cfg?: any) => {
      if (cfg?.searchTransactionHistory) return { context: { slot: 0 }, value: [opts.historyStatus ?? null] };
      const s = statuses.length > 1 ? statuses.shift()! : (statuses[0] ?? null);
      return { context: { slot: 0 }, value: [s] };
    }),
    getBlockHeight: vi.fn(async () => (heights.length > 1 ? heights.shift()! : (heights[0] ?? 0))),
  };
  return conn;
}

const noSleep = async () => {};

describe("pickPriorityFeeMicroLamports", () => {
  it("uses the 75th percentile of non-zero samples", () => {
    expect(pickPriorityFeeMicroLamports([0, 0, 20_000, 40_000, 60_000, 80_000])).toBe(80_000);
    expect(pickPriorityFeeMicroLamports([100_000, 20_000, 30_000, 40_000])).toBe(100_000);
  });
  it("floors at MIN when the network is quiet", () => {
    expect(pickPriorityFeeMicroLamports([])).toBe(SOLANA_PRIORITY_FEE_MIN_MICROLAMPORTS);
    expect(pickPriorityFeeMicroLamports([0, 0, 1])).toBe(SOLANA_PRIORITY_FEE_MIN_MICROLAMPORTS);
  });
  it("caps at MAX during spikes", () => {
    expect(pickPriorityFeeMicroLamports([50_000_000, 90_000_000])).toBe(
      SOLANA_PRIORITY_FEE_MAX_MICROLAMPORTS,
    );
  });
});

describe("estimatePriorityFeeMicroLamports", () => {
  it("falls back to the default when the RPC call fails", async () => {
    const conn = { getRecentPrioritizationFees: vi.fn().mockRejectedValue(new Error("429")) };
    await expect(estimatePriorityFeeMicroLamports(conn as any, [])).resolves.toBe(
      SOLANA_PRIORITY_FEE_DEFAULT_MICROLAMPORTS,
    );
  });
  it("queries fees for the accounts the payment writes", async () => {
    const acct = PublicKey.default;
    const conn = {
      getRecentPrioritizationFees: vi
        .fn()
        .mockResolvedValue([{ slot: 1, prioritizationFee: 25_000 }]),
    };
    await expect(estimatePriorityFeeMicroLamports(conn as any, [acct])).resolves.toBe(25_000);
    expect(conn.getRecentPrioritizationFees).toHaveBeenCalledWith({
      lockedWritableAccounts: [acct],
    });
  });
});

describe("priorityFeeInstructions", () => {
  it("emits CU limit + CU price compute-budget instructions", () => {
    const ixs = priorityFeeInstructions(80_000, 25_000);
    expect(ixs).toHaveLength(2);
    ixs.forEach((ix) => expect(ix.programId.equals(ComputeBudgetProgram.programId)).toBe(true));
  });
});

describe("rebroadcastUntilConfirmed", () => {
  it("rebroadcasts until the signature is confirmed", async () => {
    const conn = fakeConnection({
      statuses: [null, null, { err: null, confirmationStatus: "processed" }, { err: null, confirmationStatus: "confirmed" }],
      heights: [100],
    });
    const res = await rebroadcastUntilConfirmed({
      connection: conn as any,
      rawTransaction: RAW,
      signature: SIG,
      lastValidBlockHeight: 200,
      sleep: noSleep,
    });
    expect(res).toEqual({ status: "confirmed" });
    expect(conn.sendRawTransaction).toHaveBeenCalledTimes(4);
    // Preflight only on the first broadcast.
    expect(conn.sendRawTransaction.mock.calls[0][1].skipPreflight).toBe(false);
    expect(conn.sendRawTransaction.mock.calls[1][1].skipPreflight).toBe(true);
    expect(conn.sendRawTransaction.mock.calls[0][1].maxRetries).toBe(0);
  });

  it("throws SolanaTransactionExpiredError once finalized height passes expiry and history has nothing", async () => {
    const conn = fakeConnection({ statuses: [null], heights: [150, 199, 200, 201], historyStatus: null });
    const p = rebroadcastUntilConfirmed({
      connection: conn as any,
      rawTransaction: RAW,
      signature: SIG,
      lastValidBlockHeight: 200,
      sleep: noSleep,
    });
    await expect(p).rejects.toBeInstanceOf(SolanaTransactionExpiredError);
    await p.catch((e) => {
      expect(isSolanaTransactionExpiredError(e)).toBe(true);
      expect(e.message).toMatch(/did not go through/i);
      expect(e.message).toMatch(/retry/i);
    });
    expect(conn.getBlockHeight).toHaveBeenCalledWith("finalized");
    // Kept rebroadcasting while the blockhash was still valid (heights 150,199,200).
    expect(conn.sendRawTransaction).toHaveBeenCalledTimes(4);
  });

  it("does not report expiry if the tx shows up in the final history lookup", async () => {
    const conn = fakeConnection({
      statuses: [null],
      heights: [201],
      historyStatus: { err: null, confirmationStatus: "finalized" },
    });
    await expect(
      rebroadcastUntilConfirmed({
        connection: conn as any,
        rawTransaction: RAW,
        signature: SIG,
        lastValidBlockHeight: 200,
        sleep: noSleep,
      }),
    ).resolves.toEqual({ status: "confirmed" });
  });

  it("surfaces an on-chain failure", async () => {
    const conn = fakeConnection({
      statuses: [{ err: { InstructionError: [2, "Custom"] }, confirmationStatus: "confirmed" }],
      heights: [100],
    });
    await expect(
      rebroadcastUntilConfirmed({
        connection: conn as any,
        rawTransaction: RAW,
        signature: SIG,
        lastValidBlockHeight: 200,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/failed on chain/);
  });

  it("rejects immediately on a real preflight error", async () => {
    const conn = fakeConnection({
      firstSendError: new Error("Simulation failed: insufficient funds"),
      heights: [100],
    });
    await expect(
      rebroadcastUntilConfirmed({
        connection: conn as any,
        rawTransaction: RAW,
        signature: SIG,
        lastValidBlockHeight: 200,
        sleep: noSleep,
      }),
    ).rejects.toThrow(/insufficient funds/);
    expect(conn.getSignatureStatuses).not.toHaveBeenCalled();
  });

  it("tolerates a benign first-send error (RPC blockhash lag)", async () => {
    const conn = fakeConnection({
      firstSendError: new Error("Blockhash not found"),
      statuses: [{ err: null, confirmationStatus: "confirmed" }],
      heights: [100],
    });
    await expect(
      rebroadcastUntilConfirmed({
        connection: conn as any,
        rawTransaction: RAW,
        signature: SIG,
        lastValidBlockHeight: 200,
        sleep: noSleep,
      }),
    ).resolves.toEqual({ status: "confirmed" });
  });

  it("hands off (unknown) instead of claiming failure when expiry cannot be proven", async () => {
    let t = 0;
    const conn = fakeConnection({ statuses: [null] });
    conn.getBlockHeight.mockRejectedValue(new Error("rpc down"));
    await expect(
      rebroadcastUntilConfirmed({
        connection: conn as any,
        rawTransaction: RAW,
        signature: SIG,
        lastValidBlockHeight: 200,
        sleep: async (ms) => {
          t += ms;
        },
        now: () => t,
        maxWaitMs: 10_000,
        intervalMs: 2_000,
      }),
    ).resolves.toEqual({ status: "unknown" });
  });
});
