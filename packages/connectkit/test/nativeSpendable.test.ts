import { describe, expect, it } from "vitest";
import { assertNativeSpendable } from "../src/payment/nativeSpendable";

describe("native payment preflight", () => {
  it("requires quoted atomic amount plus network fee and one reserve unit", () => {
    expect(() => assertNativeSpendable(106n, 100n, 5n, "SOL")).not.toThrow();
    expect(() => assertNativeSpendable(105n, 100n, 5n, "SOL")).toThrow(
      "Insufficient spendable SOL",
    );
    expect(() => assertNativeSpendable(104n, 100n, 5n, "ETH")).toThrow(
      "Insufficient spendable ETH",
    );
    expect(() => assertNativeSpendable(200n, 0n, 5n, "XLM")).toThrow("Insufficient spendable XLM");
  });
});
