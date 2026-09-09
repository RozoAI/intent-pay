import { describe, expect, it } from "vitest";
import { resolveConfirmedPayoutTxHash } from "../src/payment/resolveConfirmedPayoutTxHash.js";

describe("resolveConfirmedPayoutTxHash", () => {
  it("uses destination hash for bridged payouts and payin hash for same-tx settlement", () => {
    expect(resolveConfirmedPayoutTxHash("source", "destination", false)).toBe(
      "destination",
    );
    expect(resolveConfirmedPayoutTxHash("source", "destination", true)).toBe(
      "source",
    );
    expect(resolveConfirmedPayoutTxHash("source", undefined, false)).toBeUndefined();
  });
});
