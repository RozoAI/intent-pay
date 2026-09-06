import { describe, expect, it } from "vitest";
import { resolveDepositSourceAmount } from "../src/payment/createPaymentPayload.js";

function makeFees(amount: string, fee: string) {
  return {
    status: "ok",
    type: "fee",
    source: { chainId: "8453", tokenSymbol: "USDC", amount, fee },
    destination: { chainId: "8453", tokenSymbol: "USDC", amount: "10" },
    feeInfo: { feePercentage: "0.5%", minimumFee: "0" },
  } as any;
}

describe("resolveDepositSourceAmount", () => {
  it("prefers the payment response source amount when fees are nonzero", () => {
    // $10 destination, payer must send 10.5 units fee-inclusive.
    expect(resolveDepositSourceAmount("10.5", makeFees("10.5", "0.5"), 10)).toBe(
      "10.5",
    );
  });

  it("uses quoted source units verbatim for non-dollar-pegged assets", () => {
    // 42 XLM for a $10 destination — the QR must say 42, never 10.
    expect(resolveDepositSourceAmount("42", makeFees("42", "0.1"), 10)).toBe(
      "42",
    );
  });

  it("falls back to the fee quote when the response carries no amount", () => {
    expect(resolveDepositSourceAmount(null, makeFees("10.5", "0.5"), 10)).toBe(
      "10.5",
    );
    expect(resolveDepositSourceAmount("", makeFees("10.5", "0.5"), 10)).toBe(
      "10.5",
    );
  });

  it("uses the destination value only as a last resort", () => {
    expect(resolveDepositSourceAmount(null, null, 10)).toBe("10");
    expect(resolveDepositSourceAmount(undefined, undefined, "7.25")).toBe(
      "7.25",
    );
  });
});
