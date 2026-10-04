import { describe, expect, it } from "vitest";
import { FeeType, rozoStellar, rozoStellarUSDC, rozoStellarUSDT0 } from "@rozoai/intent-common";
import { buildFeeQuoteParams, getCachedFee } from "../src/utils/feeCache.js";

const BASE_CHAIN = 8453;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const VALID_EVM_ADDRESS = "0xdC4313EfB37836615d820F38A6016EE76598887B";

/** 100 USDC order, 6 decimals. */
const ORDER = {
  metadata: {},
  destFinalCallTokenAmount: { amount: "100000000", token: { decimals: 6 } },
};

function build(payParams: Parameters<typeof buildFeeQuoteParams>[0]["payParams"]) {
  return buildFeeQuoteParams({
    order: ORDER,
    payParams,
    destChainId: BASE_CHAIN,
    destTokenAddress: BASE_USDC,
    destAddress: VALID_EVM_ADDRESS,
    sourceChainId: BASE_CHAIN,
    sourceTokenAddress: BASE_USDC,
    toUnits: "100",
  });
}

describe("Stellar direct fee quotes", () => {
  function quote(sourceTokenAddress: string, destTokenAddress: string, intent?: string) {
    return buildFeeQuoteParams({
      order: ORDER,
      payParams: { intent },
      destChainId: rozoStellar.chainId,
      destTokenAddress,
      destAddress: "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY",
      sourceChainId: rozoStellar.chainId,
      sourceTokenAddress,
      toUnits: "100",
    });
  }

  it("quotes identical USDC and USDT0 as direct", () => {
    expect(quote(rozoStellarUSDC.token, rozoStellarUSDC.token).intent).toBe("stellar_direct");
    expect(quote(rozoStellarUSDT0.token, rozoStellarUSDT0.token).intent).toBe("stellar_direct");
  });

  it("quotes USDT0 ↔ USDC as non-direct, even with explicit direct intent", () => {
    for (const [source, dest] of [
      [rozoStellarUSDT0.token, rozoStellarUSDC.token],
      [rozoStellarUSDC.token, rozoStellarUSDT0.token],
    ]) {
      expect(quote(source, dest).intent).toBeUndefined();
      expect(quote(source, dest, "stellar_direct").intent).toBeUndefined();
    }
  });
});

describe("getCachedFee abort", () => {
  it("returns AbortError when signal already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const res = await getCachedFee({
      appId: "test-app",
      toChain: BASE_CHAIN,
      toToken: BASE_USDC,
      toAddress: VALID_EVM_ADDRESS,
      preferredChain: BASE_CHAIN,
      preferredTokenAddress: BASE_USDC,
      toUnits: "100",
      feeType: FeeType.ExactIn,
    }, { signal: controller.signal });

    expect(res.error?.name).toBe("AbortError");
    expect(res.data).toBeNull();
  });
});

describe("buildFeeQuoteParams — feeType/amount consistency", () => {
  // Regression: the adjustment used to be gated on `payParams?.feeType !==
  // FeeType.ExactIn`, which is true when feeType is undefined (payId mode),
  // while the body still posted ExactIn. That quoted 99.70 @ EXACT_IN.
  it("does not subtract the fee when feeType is omitted (payId mode)", () => {
    const params = build(undefined);
    expect(params.feeType).toBe(FeeType.ExactIn);
    expect(params.toUnits).toBe("100");
  });

  it("does not subtract the fee for explicit ExactIn", () => {
    const params = build({ feeType: FeeType.ExactIn });
    expect(params.feeType).toBe(FeeType.ExactIn);
    expect(params.toUnits).toBe("100");
  });

  it("preserves ExactOut destination receive amount despite wallet-option fee", () => {
    const params = build({ feeType: FeeType.ExactOut });
    expect(params.feeType).toBe(FeeType.ExactOut);
    expect(params.toUnits).toBe("100");
  });
});
