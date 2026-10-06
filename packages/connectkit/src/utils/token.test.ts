import { rozoStellarUSDC, rozoStellarUSDT0, TokenSymbol } from "@rozoai/intent-common";
import { sourcePaymentTokens } from "./token";
import { describe, expect, it } from "vitest";
import { derivePayIdPreferredTokens } from "../payment/createPaymentPayload";
import { convertPreferredSymbolsToTokens, getStellarPaymentAsset } from "./token";

describe("native source registry", () => {
  it("exposes exactly one source entry per native symbol (no supportedTokens duplicate)", () => {
    for (const symbol of [TokenSymbol.SOL, TokenSymbol.XLM, TokenSymbol.ETH]) {
      expect(sourcePaymentTokens.filter((t) => t.symbol === symbol).length).toBeGreaterThan(0);
    }
    expect(sourcePaymentTokens.filter((t) => t.symbol === TokenSymbol.SOL)).toHaveLength(1);
    expect(sourcePaymentTokens.filter((t) => t.symbol === TokenSymbol.XLM)).toHaveLength(1);
  });

  it("resolves a native preferredSymbol to exactly one token", () => {
    const resolved = convertPreferredSymbolsToTokens([TokenSymbol.SOL, TokenSymbol.XLM], undefined)!;
    expect(resolved.filter((t) => t.symbol === TokenSymbol.SOL)).toHaveLength(1);
    expect(resolved.filter((t) => t.symbol === TokenSymbol.XLM)).toHaveLength(1);
  });
});

describe("Stellar USDT0 pay-in", () => {
  it("includes USDT0 in default and explicit USD source filters", () => {
    expect(convertPreferredSymbolsToTokens(undefined, undefined)).toContainEqual(rozoStellarUSDT0);
    expect(convertPreferredSymbolsToTokens([TokenSymbol.USDT0], undefined)).toEqual([
      rozoStellarUSDT0,
    ]);
    expect(convertPreferredSymbolsToTokens([TokenSymbol.USDC], undefined)).not.toContainEqual(
      rozoStellarUSDT0,
    );
  });

  it("allows USDT0 as source for USD payId payouts", () => {
    const sources = derivePayIdPreferredTokens(TokenSymbol.USDT0);
    expect(sources.preferredSymbol).toContain(TokenSymbol.USDT0);
    expect(sources.preferredTokens).toContainEqual(rozoStellarUSDT0);
    expect(derivePayIdPreferredTokens(TokenSymbol.EURC).preferredTokens).not.toContainEqual(
      rozoStellarUSDT0,
    );
  });

  it("uses registered asset code and issuer for signing", () => {
    expect(getStellarPaymentAsset(rozoStellarUSDT0.token)).toEqual({
      code: "USDT0",
      issuer: rozoStellarUSDT0.token.split(":")[1],
    });
    expect(getStellarPaymentAsset(rozoStellarUSDC.token).code).toBe("USDC");
    expect(() => getStellarPaymentAsset("USDT0:GINVALID")).toThrow("Unsupported Stellar token");
  });
});
