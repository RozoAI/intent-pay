import { describe, expect, it } from "vitest";
import { TokenSymbol } from "@rozoai/intent-common";
import { derivePayIdPreferredTokens } from "../src/payment/createPaymentPayload.js";

describe("derivePayIdPreferredTokens", () => {
  it.each([TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.USDT0, TokenSymbol.XLM])(
    "%s destination — restricts source to USD stablecoins, excludes EURC",
    (symbol) => {
      const result = derivePayIdPreferredTokens(symbol);
      expect(result.preferredSymbol).toEqual([TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.USDT0]);
      expect(result.preferredTokens).toBeDefined();
      expect(result.preferredTokens!.length).toBeGreaterThan(0);
      // no EURC leaks into a non-EURC destination's source options
      expect(result.preferredTokens!.every((tok) => tok.symbol !== TokenSymbol.EURC)).toBe(true);
      expect(result.preferredTokens!.some((tok) => tok.symbol === TokenSymbol.USDT0)).toBe(true);
    },
  );

  it("payId preferredSymbol overrides destination-derived source tokens", () => {
    const result = derivePayIdPreferredTokens(TokenSymbol.USDC, [TokenSymbol.USDT]);
    expect(result.preferredSymbol).toEqual([TokenSymbol.USDT]);
    expect(result.preferredTokens).toBeDefined();
    expect(result.preferredTokens!.every((token) => token.symbol === TokenSymbol.USDT)).toBe(true);
  });

  it("EURC destination — forces EURC-only source filter", () => {
    const result = derivePayIdPreferredTokens(TokenSymbol.EURC);

    expect(result.preferredSymbol).toEqual([TokenSymbol.EURC]);
    expect(result.preferredTokens).toBeDefined();
    expect(result.preferredTokens!.length).toBeGreaterThan(0);
    // every returned token has symbol EURC — no USDC/USDT leaks in
    expect(result.preferredTokens!.every((tok) => tok.symbol === TokenSymbol.EURC)).toBe(true);
  });
});
