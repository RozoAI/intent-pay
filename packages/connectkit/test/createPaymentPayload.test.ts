import test from "tape";
import { FeeType } from "@rozoai/intent-common";
import { buildCreatePaymentPayload } from "../src/payment/createPaymentPayload.js";
import { PayParams } from "../src/payment/paymentFsm.js";

const VALID_EVM_ADDRESS = "0x1a5FdBc891c5D4E6aD68064Ae45D43146D4F9f3a";

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

// ---------- toUnits serialization ----------

test("toUnits: ExactIn — raw amount forwarded as clean decimal", (t) => {
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ toUnits: "10.123456" }),
    feeTypeOverride: FeeType.ExactIn,
  });

  // ExactIn does not subtract fees; toUnits should match raw input
  t.equal(payload.toUnits, "10.123456", "toUnits matches input");
  t.ok(!/e/.test(payload.toUnits), "no scientific notation");
  t.end();
});

test("toUnits: ExactOut fee subtraction — no floating-point noise", (t) => {
  // 0.3 - 0.1 in JS = 0.19999999999999998 without rounding
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ toUnits: "0.3" }),
    feeTypeOverride: FeeType.ExactOut,
    walletOption: {
      required: { token: { chainId: BASE_CHAIN, token: BASE_USDC } },
      fees: { usd: 0.1 },
    } as any,
  });

  t.equal(payload.toUnits, "0.2", "fee subtraction rounded, no float noise");
  t.end();
});

test("toUnits: sub-decimal precision — rounds to token decimals", (t) => {
  // 1e-7 on USDC (6 decimals) → rounds to 0
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ toUnits: "0.0000001" }),
    feeTypeOverride: FeeType.ExactIn,
  });

  // USDC has 6 decimals; sub-1e-6 correctly rounds to 0
  t.equal(payload.toUnits, "0", "sub-decimal precision rounds to 0 for 6-decimal token");
  t.ok(!/e/.test(payload.toUnits), "no scientific notation");
  t.end();
});

test("toUnits: fee exceeds amount — clamped to zero", (t) => {
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ toUnits: "0.05" }),
    feeTypeOverride: FeeType.ExactOut,
    walletOption: {
      required: { token: { chainId: BASE_CHAIN, token: BASE_USDC } },
      fees: { usd: 0.1 },
    } as any,
  });

  t.equal(payload.toUnits, "0", "clamped to zero when fee > amount");
  t.end();
});

test("toUnits: large-magnitude amount — no float precision loss", (t) => {
  // Number("123456789012345.678901") loses precision past ~15-17 sig figs;
  // string/BigInt-based scaling must not.
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ toUnits: "123456789012345.678901" }),
    feeTypeOverride: FeeType.ExactIn,
  });

  t.equal(payload.toUnits, "123456789012345.678901", "large amount forwarded exactly");
  t.end();
});

// ---------- address resolution ----------

test("resolveDestinationAddress: Solana takes precedence", (t) => {
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({
      toAddress: VALID_EVM_ADDRESS,
      toSolanaAddress: "E35325pbtxCRsA4uVoC3cyBDZy8BMpmxvsvGcHNUa18k",
    }),
  });

  t.equal(payload.toAddress, "E35325pbtxCRsA4uVoC3cyBDZy8BMpmxvsvGcHNUa18k");
  t.end();
});

test("resolveDestinationAddress: Stellar takes precedence over EVM", (t) => {
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({
      toAddress: VALID_EVM_ADDRESS,
      toStellarAddress: "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY",
    }),
  });

  t.equal(payload.toAddress, "GDATMUNQEPN4TPETV47LAKGJELK4DUHHDRPMGD3K5LOHUPXX2DI623KY");
  t.end();
});

// ---------- payload structure ----------

test("payload includes basic fields", (t) => {
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ toUnits: "5" }),
  });

  t.equal(payload.appId, "test-app");
  t.equal(payload.toChain, BASE_CHAIN);
  t.equal(payload.toToken, BASE_USDC);
  t.equal(payload.toAddress, VALID_EVM_ADDRESS);
  t.equal(payload.toUnits, "5");
  t.equal(payload.apiVersion, "v2");
  t.end();
});

test("payload defaults appId to Rozo when not provided", (t) => {
  const payload = buildCreatePaymentPayload({
    payParams: makePayParams({ appId: undefined }),
  });

  // DEFAULT_ROZO_APP_ID is the constant; just check it's not empty
  t.ok(payload.appId, "appId is set");
  t.end();
});
