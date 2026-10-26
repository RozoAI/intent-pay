import { polygon, TokenSymbol } from "@rozoai/intent-common";
import { describe, expect, it } from "vitest";
import { derivePayIdPreferredTokens } from "./createPaymentPayload";
import {
  hasRelaxableSourcePreference,
  resolvePayIdSourcePreference,
} from "./resolvePayIdSourcePreference";

const button = {
  preferredChains: [polygon.chainId],
  preferredSymbol: [TokenSymbol.USDC],
};

describe("resolvePayIdSourcePreference", () => {
  it("narrows by button preferredSymbol and preferredChains when not relaxed", () => {
    const r = resolvePayIdSourcePreference("USDC", button, false);
    expect(r.preferredChains).toEqual([polygon.chainId]);
    expect(r.preferredSymbol).toEqual([TokenSymbol.USDC]);
    expect(r.preferredTokens?.length).toBeGreaterThan(0);
    for (const t of r.preferredTokens ?? []) {
      expect(t.chainId).toBe(polygon.chainId);
      expect(t.symbol).toBe(TokenSymbol.USDC);
    }
  });

  it("relaxed drops button chains and symbol but keeps destination-derived floor", () => {
    const r = resolvePayIdSourcePreference("USDC", button, true);
    const floor = derivePayIdPreferredTokens("USDC", undefined);
    expect(r.preferredChains).toBeUndefined();
    expect(r.preferredSymbol).toEqual(floor.preferredSymbol);
    expect(r.preferredTokens).toEqual(floor.preferredTokens);
    expect(new Set(r.preferredTokens?.map((t) => t.chainId)).size).toBeGreaterThan(1);
  });

  it("relaxed EURC destination still only allows EURC", () => {
    const r = resolvePayIdSourcePreference("EURC", { preferredSymbol: [TokenSymbol.USDC] }, true);
    expect(r.preferredSymbol).toEqual([TokenSymbol.EURC]);
    for (const t of r.preferredTokens ?? []) expect(t.symbol).toBe(TokenSymbol.EURC);
  });

  it("empty chain intersection falls back to full derived set", () => {
    const r = resolvePayIdSourcePreference("USDC", { preferredChains: [999999999] }, false);
    expect(r.preferredTokens).toEqual(derivePayIdPreferredTokens("USDC", undefined).preferredTokens);
  });
});

describe("hasRelaxableSourcePreference", () => {
  it("is false with no button narrowing", () => {
    expect(hasRelaxableSourcePreference(undefined)).toBe(false);
    expect(hasRelaxableSourcePreference({ preferredChains: [] })).toBe(false);
  });
  it("is true when chains or symbol narrow", () => {
    expect(hasRelaxableSourcePreference({ preferredChains: [polygon.chainId] })).toBe(true);
    expect(hasRelaxableSourcePreference({ preferredSymbol: [TokenSymbol.USDC] })).toBe(true);
  });
});
