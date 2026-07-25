import { describe, expect, it } from "vitest";
import { FeeType } from "@rozoai/intent-common";
import { buildCreatePaymentPayload } from "../src/payment/createPaymentPayload.js";
import { PayParams } from "../src/payment/paymentFsm.js";

const VALID_EVM_ADDRESS = "0xdC4313EfB37836615d820F38A6016EE76598887B";

const BASE_CHAIN = 8453;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function makePayParams(overrides: Partial<PayParams> = {}): PayParams {
  return {
    appId: "test-app",
    toChain: BASE_CHAIN,
    toToken: BASE_USDC,
    toAddress: VALID_EVM_ADDRESS,
    toUnits: "10",
    feeType: FeeType.ExactIn,
    ...overrides,
  };
}

describe("toUnits serialization", () => {
  it("ExactIn — raw amount forwarded as clean decimal", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ toUnits: "10.123456" }),
      feeTypeOverride: FeeType.ExactIn,
    });

    // ExactIn does not subtract fees; toUnits should match raw input
    expect(payload.toUnits).toBe("10.123456");
    expect(payload.toUnits).not.toMatch(/e/);
  });

  it("ExactOut fee subtraction — no floating-point noise", () => {
    // 0.3 - 0.1 in JS = 0.19999999999999998 without rounding
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ toUnits: "0.3" }),
      feeTypeOverride: FeeType.ExactOut,
      walletOption: {
        required: { token: { chainId: BASE_CHAIN, token: BASE_USDC } },
        fees: { usd: 0.1 },
      } as any,
    });

    expect(payload.toUnits).toBe("0.2");
  });

  it("sub-decimal precision — rounds to token decimals", () => {
    // 1e-7 on USDC (6 decimals) → rounds to 0
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ toUnits: "0.0000001" }),
      feeTypeOverride: FeeType.ExactIn,
    });

    expect(payload.toUnits).toBe("0");
    expect(payload.toUnits).not.toMatch(/e/);
  });

  it("fee exceeds amount — clamped to zero", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ toUnits: "0.05" }),
      feeTypeOverride: FeeType.ExactOut,
      walletOption: {
        required: { token: { chainId: BASE_CHAIN, token: BASE_USDC } },
        fees: { usd: 0.1 },
      } as any,
    });

    expect(payload.toUnits).toBe("0");
  });

  it("large-magnitude amount — no float precision loss", () => {
    // Number("123456789012345.678901") loses precision past ~15-17 sig figs;
    // string/BigInt-based scaling must not.
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ toUnits: "123456789012345.678901" }),
      feeTypeOverride: FeeType.ExactIn,
    });

    expect(payload.toUnits).toBe("123456789012345.678901");
  });
});

describe("resolveDestinationAddress", () => {
  it("Solana takes precedence", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({
        toAddress: VALID_EVM_ADDRESS,
        toSolanaAddress: "E35325pbtxCRsA4uVoC3cyBDZy8BMpmxvsvGcHNUa18k",
      }),
    });

    expect(payload.toAddress).toBe("E35325pbtxCRsA4uVoC3cyBDZy8BMpmxvsvGcHNUa18k");
  });

  it("Stellar takes precedence over EVM", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({
        toAddress: VALID_EVM_ADDRESS,
        toStellarAddress: "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY",
      }),
    });

    expect(payload.toAddress).toBe("GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY");
  });
});

describe("payload structure", () => {
  it("includes basic fields", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ toUnits: "5" }),
    });

    expect(payload.appId).toBe("test-app");
    expect(payload.toChain).toBe(BASE_CHAIN);
    expect(payload.toToken).toBe(BASE_USDC);
    expect(payload.toAddress).toBe(VALID_EVM_ADDRESS);
    expect(payload.toUnits).toBe("5");
    expect(payload.apiVersion).toBe("v2");
  });

  it("defaults appId to Rozo when not provided", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ appId: undefined }),
    });

    // DEFAULT_ROZO_APP_ID is the constant; just check it's not empty
    expect(payload.appId).toBeTruthy();
  });
});
