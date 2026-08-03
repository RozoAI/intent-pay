import { describe, expect, it } from "vitest";
import { FeeType } from "@rozoai/intent-common";
import { buildCreatePaymentPayload } from "../src/payment/createPaymentPayload.js";
import { PayParams, PaymentState, PaymentEvent } from "../src/payment/paymentFsm.js";
import { buildHydratePayParamsPayload } from "../src/payment/paymentEffects.js";

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

describe("intent field", () => {
  // Regression test: the EVM PayWithToken flow persists a narrowed
  // PayParamsData (paymentFsm.ts) between preview and payment creation.
  // That type previously omitted `intent`, so a top-level intent flag set
  // via RozoPayButton's `intent` prop (e.g. "stellarsponsor") silently
  // never reached the actual createPayment call — only metadata.intent
  // (the unrelated display title) survived. This asserts the top-level
  // field a PayParamsData-shaped object carries reaches the payload.
  it("forwards a top-level intent flag to the payload", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({ intent: "stellarsponsor" }),
    });

    expect(payload.intent).toBe("stellarsponsor");
  });

  it("omits intent from the payload when not set", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams(),
    });

    expect(payload.intent).toBeUndefined();
  });

  it("keeps intent distinct from metadata.intent (the display title)", () => {
    const payload = buildCreatePaymentPayload({
      payParams: makePayParams({
        intent: "stellarsponsor",
        metadata: { intent: "Bridge USDC to Stellar" },
      }),
    });

    expect(payload.intent).toBe("stellarsponsor");
    expect(payload.metadata?.intent).toBe("Bridge USDC to Stellar");
  });
});

describe("hydrate_order effect — PayParamsData narrowing", () => {
  // Regression test for the EVM PayWithToken flow specifically: PayParams
  // set via set_pay_params is narrowed to PayParamsData when the reducer
  // stores it on the "preview" state (paymentFsm.ts). Only fields present
  // on that narrowed type survive to the createPayment call triggered by
  // hydrate_order (PayWithSolanaToken and PayWithStellarToken take a
  // different path — paymentState.createPayment — and use full PayParams
  // directly, so they were never affected by this). This test builds a
  // "preview" state the way the reducer actually does, then asserts the
  // payload buildHydratePayParamsPayload produces for hydrate_order still
  // carries the top-level intent flag.
  function makePreviewState(
    payParamsDataOverrides: Partial<Extract<PaymentState, { type: "preview" }>["payParamsData"]> = {},
  ): Extract<PaymentState, { type: "preview" }> {
    return {
      type: "preview",
      order: undefined as any,
      payParamsData: {
        appId: "test-app",
        // toChain/toToken aren't in PayParamsData's declared type, but the
        // real runtime object always carries them (see the `as any` cast at
        // buildHydratePayParamsPayload's call site) — buildCreatePaymentPayload
        // needs them when `order` isn't provided, same as production.
        toChain: BASE_CHAIN,
        toToken: BASE_USDC,
        ...payParamsDataOverrides,
      } as any,
    };
  }

  const hydrateEvent: Extract<PaymentEvent, { type: "hydrate_order" }> = {
    type: "hydrate_order",
  };

  it("carries the top-level intent flag into the createPayment payload", () => {
    const prev = makePreviewState({ intent: "stellarsponsor" });
    const payload = buildHydratePayParamsPayload(prev, hydrateEvent);

    expect(payload.intent).toBe("stellarsponsor");
  });

  it("omits intent from the payload when the preview state never carried one", () => {
    const prev = makePreviewState();
    const payload = buildHydratePayParamsPayload(prev, hydrateEvent);

    expect(payload.intent).toBeUndefined();
  });
});
