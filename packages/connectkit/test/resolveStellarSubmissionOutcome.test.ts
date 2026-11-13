import { describe, expect, it, vi } from "vitest";
import { resolveStellarSubmissionOutcome } from "../src/payment/resolveStellarSubmissionOutcome";

const HASH = "a".repeat(64);

function clock(start = 1_000_000_000_000) {
  let t = start;
  return {
    now: () => t,
    sleep: vi.fn(async (ms: number) => {
      t += ms;
    }),
  };
}

describe("resolveStellarSubmissionOutcome", () => {
  it("returns success when Horizon has the tx and it succeeded", async () => {
    const c = clock();
    const lookupTx = vi
      .fn()
      .mockResolvedValueOnce({ found: false })
      .mockResolvedValueOnce({ found: true, successful: true });
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: c.now() / 1000 + 180,
      lookupTx,
      latestLedgerCloseTime: async () => c.now() / 1000,
      now: c.now,
      sleep: c.sleep,
    });
    expect(outcome).toEqual({ kind: "success", txHash: HASH });
    expect(lookupTx).toHaveBeenCalledWith(HASH);
  });

  it("returns failed when Horizon has the tx and it failed", async () => {
    const c = clock();
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: c.now() / 1000 + 180,
      lookupTx: async () => ({ found: true, successful: false }),
      latestLedgerCloseTime: async () => c.now() / 1000,
      now: c.now,
      sleep: c.sleep,
    });
    expect(outcome.kind).toBe("failed");
  });

  it("keeps polling while not found and the ledger has not passed max_time", async () => {
    const c = clock();
    const maxTime = c.now() / 1000 + 30;
    let calls = 0;
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime,
      lookupTx: async () => {
        calls += 1;
        return calls < 10 ? { found: false } : { found: true, successful: true };
      },
      latestLedgerCloseTime: async () => c.now() / 1000,
      now: c.now,
      sleep: c.sleep,
      intervalMs: 2_000,
    });
    // 10th lookup happens at +18s, still before max_time: must not give up.
    expect(outcome.kind).toBe("success");
  });

  it("returns expired only once Horizon reports a ledger closed after max_time", async () => {
    const c = clock();
    const maxTime = c.now() / 1000 + 10;
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime,
      lookupTx: async () => ({ found: false }),
      latestLedgerCloseTime: async () => c.now() / 1000,
      now: c.now,
      sleep: c.sleep,
      intervalMs: 2_000,
    });
    expect(outcome.kind).toBe("expired");
    // At least ~10s of polling elapsed before declaring expiry.
    expect(c.now() / 1000).toBeGreaterThan(maxTime);
  });

  it("does not declare expired when the ledger close time equals max_time", async () => {
    const c = clock();
    const maxTime = c.now() / 1000 + 10;
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime,
      lookupTx: async () => ({ found: false }),
      // Horizon stuck at a ledger closing exactly at max_time: the tx could
      // still be in it or in the next valid ledger, so this is not proof.
      latestLedgerCloseTime: async () => maxTime,
      now: c.now,
      sleep: c.sleep,
      maxTimeGraceMs: 20_000,
    });
    expect(outcome.kind).toBe("unknown");
  });

  it("returns unknown (never expired/failed) when the local clock is ahead of the ledger", async () => {
    const c = clock();
    const maxTime = c.now() / 1000 + 10;
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime,
      lookupTx: async () => ({ found: false }),
      // Ledger lags the device clock by 10 minutes.
      latestLedgerCloseTime: async () => c.now() / 1000 - 600,
      now: c.now,
      sleep: c.sleep,
    });
    expect(outcome.kind).toBe("unknown");
  });

  it("returns unknown when Horizon keeps erroring", async () => {
    const c = clock();
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: c.now() / 1000 + 10,
      lookupTx: async () => {
        throw new Error("502");
      },
      latestLedgerCloseTime: async () => c.now() / 1000,
      now: c.now,
      sleep: c.sleep,
    });
    expect(outcome.kind).toBe("unknown");
  });

  it("recovers from transient Horizon errors", async () => {
    const c = clock();
    const lookupTx = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ found: true, successful: true });
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: c.now() / 1000 + 180,
      lookupTx,
      latestLedgerCloseTime: async () => c.now() / 1000,
      now: c.now,
      sleep: c.sleep,
    });
    expect(outcome.kind).toBe("success");
  });

  it("without max_time, polls for the bounded budget then returns unknown", async () => {
    const c = clock();
    const start = c.now();
    const latestLedgerCloseTime = vi.fn(async () => c.now() / 1000 + 10_000);
    const outcome = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: 0,
      lookupTx: async () => ({ found: false }),
      latestLedgerCloseTime,
      now: c.now,
      sleep: c.sleep,
      noMaxTimeBudgetMs: 60_000,
    });
    expect(outcome.kind).toBe("unknown");
    expect(c.now() - start).toBeGreaterThanOrEqual(60_000);
    // Without max_time a ledger time can never prove expiry.
    expect(latestLedgerCloseTime).not.toHaveBeenCalled();
  });

  it("propagates abort", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      resolveStellarSubmissionOutcome({
        txHash: HASH,
        maxTime: 0,
        lookupTx: async () => ({ found: false }),
        latestLedgerCloseTime: async () => 0,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("still reads the tx when the ledger query keeps failing, but never declares expired", async () => {
    const c = clock();
    const success = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: c.now() / 1000 + 10,
      lookupTx: async () => ({ found: true, successful: true }),
      latestLedgerCloseTime: async () => {
        throw new Error("ledgers 503");
      },
      now: c.now,
      sleep: c.sleep,
    });
    expect(success.kind).toBe("success");

    const notFound = await resolveStellarSubmissionOutcome({
      txHash: HASH,
      maxTime: c.now() / 1000 + 10,
      lookupTx: async () => ({ found: false }),
      latestLedgerCloseTime: async () => {
        throw new Error("ledgers 503");
      },
      now: c.now,
      sleep: c.sleep,
    });
    expect(notFound.kind).toBe("unknown");
  });
});
