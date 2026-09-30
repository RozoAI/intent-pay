import { describe, expect, it } from "vitest";
import { waitForPaymentSourceTxHash } from "../src/payment/waitForPaymentSourceTxHash.js";

const oldHash = `0x${"1".repeat(64)}`;
const newHash = `0x${"2".repeat(64)}`;
const stellarHash = "a".repeat(64);

describe("waitForPaymentSourceTxHash", () => {
  it("waits for a new backend-confirmed source transaction", async () => {
    const hashes = [oldHash, undefined, newHash];
    let calls = 0;

    const result = await waitForPaymentSourceTxHash("payment-id", {
      intervalMs: 0,
      ignoreTxHash: oldHash,
      fetchSourceTxHash: async () => hashes[calls++],
    });

    expect(result).toBe(newHash);
    expect(calls).toBe(3);
  });

  it("accepts a Stellar transaction hash with a chain-specific validator", async () => {
    const result = await waitForPaymentSourceTxHash("payment-id", {
      intervalMs: 0,
      isValidTxHash: (txHash): txHash is string =>
        /^[0-9a-f]{64}$/i.test(txHash),
      fetchSourceTxHash: async () => stellarHash,
    });

    expect(result).toBe(stellarHash);
  });
});
