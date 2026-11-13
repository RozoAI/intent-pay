import { describe, expect, it } from "vitest";
import {
  clearPendingStellarSubmission,
  readPendingStellarSubmissions,
  savePendingStellarSubmission,
} from "../src/payment/stellarPendingSubmission";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  };
}

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const key = (account: string) => `rozo_stellar_pending_submission:${account}`;
const hashes = (
  account: string,
  storage?: Parameters<typeof readPendingStellarSubmissions>[1],
) => readPendingStellarSubmissions(account, storage).map((e) => e.txHash);

describe("stellarPendingSubmission", () => {
  it("round-trips records per account", () => {
    const storage = memoryStorage();
    savePendingStellarSubmission(
      "G1",
      { txHash: HASH_A, maxTime: 123, paymentId: "p1", recordedAt: 1 },
      storage,
    );
    expect(readPendingStellarSubmissions("G1", storage)).toMatchObject([
      { txHash: HASH_A, maxTime: 123, paymentId: "p1", confirmed: false },
    ]);
    expect(readPendingStellarSubmissions("GOTHER", storage)).toEqual([]);
  });

  it("keeps one record per tx hash: a late update for A never overwrites B", () => {
    const storage = memoryStorage();
    savePendingStellarSubmission(
      "G2",
      { txHash: HASH_B, maxTime: 2, recordedAt: 2 },
      storage,
    );
    savePendingStellarSubmission(
      "G2",
      { txHash: HASH_A, maxTime: 1, recordedAt: 3, walletStatus: "unknown" },
      storage,
    );
    expect(hashes("G2", storage)).toEqual([HASH_B, HASH_A]);
    clearPendingStellarSubmission("G2", HASH_A, storage);
    expect(hashes("G2", storage)).toEqual([HASH_B]);
    clearPendingStellarSubmission("G2", HASH_B, storage);
    expect(hashes("G2", storage)).toEqual([]);
    expect(storage.map.has(key("G2"))).toBe(false);
  });

  it("ignores malformed data", () => {
    const storage = memoryStorage();
    storage.setItem(key("G3"), "{not json");
    expect(readPendingStellarSubmissions("G3", storage)).toEqual([]);
    storage.setItem(
      key("G3"),
      JSON.stringify({ x: { txHash: "nothex" }, y: { txHash: HASH_A } }),
    );
    expect(hashes("G3", storage)).toEqual([HASH_A]);
  });

  it("keeps records in memory without storage", () => {
    savePendingStellarSubmission(
      "G4",
      { txHash: HASH_A, maxTime: 0, recordedAt: 0 },
      undefined,
    );
    expect(hashes("G4", undefined)).toEqual([HASH_A]);
  });

  it("memory state wins over a stale storage value when writes fail", () => {
    const stale = JSON.stringify({
      [HASH_A]: { txHash: HASH_A, maxTime: 1, recordedAt: 1 },
    });
    const readOnly = {
      getItem: () => stale,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    // Before any in-page write the persisted value is used (reload case).
    expect(hashes("G5", readOnly)).toEqual([HASH_A]);
    clearPendingStellarSubmission("G5", HASH_A, readOnly);
    expect(hashes("G5", readOnly)).toEqual([]);
    savePendingStellarSubmission(
      "G5",
      { txHash: HASH_B, maxTime: 2, recordedAt: 2 },
      readOnly,
    );
    expect(hashes("G5", readOnly)).toEqual([HASH_B]);
  });

  it("sees another tab's record when storage works", () => {
    const shared = memoryStorage();
    savePendingStellarSubmission(
      "G6",
      { txHash: HASH_A, maxTime: 1, recordedAt: 1 },
      shared,
    );
    clearPendingStellarSubmission("G6", HASH_A, shared);
    // Another tab writes a new unresolved record directly to storage.
    shared.setItem(
      key("G6"),
      JSON.stringify({
        [HASH_B]: { txHash: HASH_B, maxTime: 2, recordedAt: 2 },
      }),
    );
    expect(hashes("G6", shared)).toEqual([HASH_B]);
  });

  it("keepConfirmed does not clear a confirmed record", () => {
    const storage = memoryStorage();
    savePendingStellarSubmission(
      "G7",
      { txHash: HASH_A, maxTime: 0, recordedAt: 1, confirmed: true },
      storage,
    );
    clearPendingStellarSubmission("G7", HASH_A, storage, {
      keepConfirmed: true,
    });
    expect(readPendingStellarSubmissions("G7", storage)[0]?.confirmed).toBe(
      true,
    );
    clearPendingStellarSubmission("G7", HASH_A, storage);
    expect(readPendingStellarSubmissions("G7", storage)).toEqual([]);
  });

  it("uses this page's last state when a storage read throws", () => {
    let readable = true;
    const backing = memoryStorage();
    const flaky = {
      getItem: (k: string) => {
        if (!readable) throw new Error("SecurityError");
        return backing.getItem(k);
      },
      setItem: backing.setItem,
      removeItem: backing.removeItem,
    };
    savePendingStellarSubmission(
      "G8",
      { txHash: HASH_A, maxTime: 1, recordedAt: 1 },
      flaky,
    );
    readable = false;
    expect(hashes("G8", flaky)).toEqual([HASH_A]);
  });
});
