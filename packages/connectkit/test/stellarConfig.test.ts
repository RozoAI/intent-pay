import { describe, expect, it } from "vitest";

import {
  getStellarInsufficientXlmMessage,
  STELLAR_INSUFFICIENT_XLM_BASE,
} from "../src/constants/rozoConfig";

describe("getStellarInsufficientXlmMessage", () => {
  const BASE_FEE_XLM = 0.00001;

  it("reports the reserve shortfall plus fee when account is below reserve", () => {
    // spendable = -0.5 → account below reserve by 0.5 XLM (e.g. USDC trustline)
    const msg = getStellarInsufficientXlmMessage(-0.5, BASE_FEE_XLM);
    expect(msg).toContain("0.5000100 XLM");
    expect(msg).toContain("minimum reserve");
    expect(msg).toContain(STELLAR_INSUFFICIENT_XLM_BASE);
  });

  it("reports shortfall when spendable is positive but below fee", () => {
    // spendable = 0.000005 XLM — has reserve but not enough for fee
    const msg = getStellarInsufficientXlmMessage(0.000005, BASE_FEE_XLM);
    expect(msg).toContain("0.0000050 XLM");
    expect(msg).toContain("network fee");
    expect(msg).toContain(STELLAR_INSUFFICIENT_XLM_BASE);
  });

  it("reports exact shortfall when spendable is zero", () => {
    const msg = getStellarInsufficientXlmMessage(0, BASE_FEE_XLM);
    expect(msg).toContain("0.0000100 XLM");
    expect(msg).toContain("network fee");
  });

  it("handles sponsored entries correctly (large negative spendable)", () => {
    // spendable = -2.5 → heavily negative, multiple sponsored entries
    const msg = getStellarInsufficientXlmMessage(-2.5, BASE_FEE_XLM);
    expect(msg).toContain("2.5000100 XLM");
    expect(msg).toContain("minimum reserve");
  });

  it("USDC-trustline account: 1 subentry, spendable = 1.0 - 1.5 = -0.5", () => {
    // Simulated: native=1.0, reserve=1.5 (2 base + 1 trustline - 0 sponsored)
    const nativeBalance = 1.0;
    const minReserve = 1.5; // (2 + 1) * 0.5
    const spendable = nativeBalance - minReserve; // -0.5
    const msg = getStellarInsufficientXlmMessage(spendable, 0.00001);
    expect(msg).toContain("0.5000100 XLM");
    expect(msg).toContain("minimum reserve");
  });
});

describe("STELLAR_INSUFFICIENT_XLM_BASE", () => {
  it("is a non-empty string", () => {
    expect(typeof STELLAR_INSUFFICIENT_XLM_BASE).toBe("string");
    expect(STELLAR_INSUFFICIENT_XLM_BASE.length).toBeGreaterThan(0);
  });

  it("contains actionable instructions", () => {
    expect(STELLAR_INSUFFICIENT_XLM_BASE).toContain("XLM");
    expect(STELLAR_INSUFFICIENT_XLM_BASE).toContain("add");
  });
});
