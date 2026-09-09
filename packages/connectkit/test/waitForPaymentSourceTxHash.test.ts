import { describe, expect, it } from "vitest";
import { waitForPaymentSourceTxHash } from "../src/payment/waitForPaymentSourceTxHash.js";

const oldHash = `0x${"1".repeat(64)}`;
const newHash = `0x${"2".repeat(64)}`;

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
});
