import { describe, expect, it } from "vitest";
import { TokenSymbol } from "@rozoai/intent-common";
import { derivePayIdPreferredTokens } from "../src/payment/createPaymentPayload.js";

describe("derivePayIdPreferredTokens", () => {
  it.each([TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.XLM])(
    "%s destination — restricts source to USDC/USDT, excludes EURC",
    (symbol) => {
      const result = derivePayIdPreferredTokens(symbol);
      expect(result.preferredSymbol).toEqual([TokenSymbol.USDC, TokenSymbol.USDT]);
      expect(result.preferredTokens).toBeDefined();
      expect(result.preferredTokens!.length).toBeGreaterThan(0);
      // no EURC leaks into a non-EURC destination's source options
      expect(result.preferredTokens!.every((tok) => tok.symbol !== TokenSymbol.EURC)).toBe(true);
    },
  );

  it("EURC destination — forces EURC-only source filter", () => {
    const result = derivePayIdPreferredTokens(TokenSymbol.EURC);

    expect(result.preferredSymbol).toEqual([TokenSymbol.EURC]);
    expect(result.preferredTokens).toBeDefined();
    expect(result.preferredTokens!.length).toBeGreaterThan(0);
    // every returned token has symbol EURC — no USDC/USDT leaks in
    expect(result.preferredTokens!.every((tok) => tok.symbol === TokenSymbol.EURC)).toBe(true);
  });
});
