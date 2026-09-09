import { describe, expect, it } from "vitest";
import { FeeType } from "@rozoai/intent-common";
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
    feeUsd: 0.3,
  });
}

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

  it("subtracts the fee for ExactOut", () => {
    const params = build({ feeType: FeeType.ExactOut });
    expect(params.feeType).toBe(FeeType.ExactOut);
    expect(params.toUnits).toBe("99.7");
  });
});
