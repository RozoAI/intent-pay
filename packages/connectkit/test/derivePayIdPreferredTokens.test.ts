import { describe, expect, it } from "vitest";
import { baseETH, bscBNB, TokenSymbol } from "@rozoai/intent-common";
import { derivePayIdPreferredTokens } from "../src/payment/createPaymentPayload.js";
import { NATIVE_SYMBOLS } from "../src/utils/token";

describe("derivePayIdPreferredTokens", () => {
  it.each([TokenSymbol.USDC, TokenSymbol.USDT, TokenSymbol.USDT0, TokenSymbol.XLM])(
    "%s destination — restricts source to USD stablecoins plus natives, excludes EURC",
    (symbol) => {
      const result = derivePayIdPreferredTokens(symbol);
      expect(result.preferredSymbol).toEqual([
        TokenSymbol.USDC,
        TokenSymbol.USDT,
        TokenSymbol.USDT0,
        ...NATIVE_SYMBOLS,
      ]);
      expect(result.preferredTokens).toBeDefined();
      expect(result.preferredTokens!.length).toBeGreaterThan(0);
      // no EURC leaks into a non-EURC destination's source options
      expect(result.preferredTokens!.every((tok) => tok.symbol !== TokenSymbol.EURC)).toBe(true);
      expect(result.preferredTokens!.some((tok) => tok.symbol === TokenSymbol.USDT0)).toBe(true);
    },
  );

  // Regression: preferredTokens is a hard allowlist in useWalletPaymentOptions,
  // so a stablecoin-only derived set deleted every native source (ETH/BNB/SOL)
  // from payId checkout even when the proxy had returned them.
  it("keeps native sources in the payId allowlist", () => {
    const { preferredTokens } = derivePayIdPreferredTokens(TokenSymbol.USDC);
    expect(preferredTokens).toContainEqual(baseETH);
    expect(preferredTokens).toContainEqual(bscBNB);
    const symbols = new Set(preferredTokens!.map((token) => token.symbol));
    for (const native of [TokenSymbol.ETH, TokenSymbol.BNB, TokenSymbol.POL, TokenSymbol.SOL]) {
      expect(symbols.has(native)).toBe(true);
    }
  });

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
