import { describe, expect, it } from "vitest";

import {
  calculateStellarSpendableStroops,
  calculateStellarSpendableXlm,
} from "../src/utils/stellar/spendableBalance";

describe("calculateStellarSpendableXlm", () => {
  it("subtracts reserve and selling liabilities", () => {
    expect(
      calculateStellarSpendableXlm({
        nativeBalance: { balance: "2", selling_liabilities: "0.25" },
        subentryCount: 1,
      }),
    ).toBeCloseTo(0.25);
  });

  it("accounts for sponsored and sponsoring entries", () => {
    expect(
      calculateStellarSpendableXlm({
        nativeBalance: { balance: "3" },
        subentryCount: 2,
        numSponsored: 1,
        numSponsoring: 2,
      }),
    ).toBeCloseTo(0.5);
  });

  it("preserves an exact-fee balance in stroops", () => {
    const spendableStroops = calculateStellarSpendableStroops({
      nativeBalance: { balance: "4.0000100" },
      subentryCount: 6,
    });

    expect(spendableStroops).toBe(100n);
    expect(spendableStroops < 100n).toBe(false);
  });

  it("rejects invalid Horizon balances", () => {
    expect(() =>
      calculateStellarSpendableXlm({ nativeBalance: { balance: "not-a-number" } }),
    ).toThrow("Could not determine XLM balance");
  });
});
