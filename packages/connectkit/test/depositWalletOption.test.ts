import { describe, expect, it } from "vitest";
import { FeeType, WalletPaymentOption } from "@rozoai/intent-common";
import {
  buildCreatePaymentPayload,
  buildDepositWalletOption,
} from "../src/payment/createPaymentPayload.js";
import { PayParams } from "../src/payment/paymentFsm.js";

const BASE_CHAIN = 8453;
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const POLYGON_CHAIN = 137;
const POLYGON_USDC = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c335";

function makeOption(chainId: number, token: string, symbol: string) {
  return {
    id: "deposit" as any,
    logoURI: "",
    minimumUsd: 0,
    chainId,
    token: {
      chainId,
      token,
      symbol,
      decimals: 6,
      logoURI: "",
      logoSourceURI: "",
    },
  } as any;
}

function makeFees(amount: string, fee: string) {
  return {
    status: "ok",
    type: "fee",
    source: { chainId: "8453", tokenSymbol: "USDC", amount, fee },
    destination: { chainId: "8453", tokenSymbol: "USDC", amount },
    feeInfo: { feePercentage: "0.5%", minimumFee: "0" },
  } as any;
}

function makePayParams(): PayParams {
  return {
    appId: "test-app",
    toChain: BASE_CHAIN,
    toToken: BASE_USDC,
    toAddress: "0xdC4313EfB37836615d820F38A6016EE76598887B",
    toUnits: "10",
    feeType: FeeType.ExactIn,
  };
}

describe("buildDepositWalletOption", () => {
  it("maps the selected option's chain/token/symbol and parses the fee quote", () => {
    const out = buildDepositWalletOption(
      makeOption(BASE_CHAIN, BASE_USDC, "USDC"),
      makeFees("10.5", "0.25"),
      10,
    );
    expect(out.required.token).toEqual({
      chainId: BASE_CHAIN,
      token: BASE_USDC,
      symbol: "USDC",
    });
    expect(out.required.usd).toBe(10.5);
    expect(out.fees.usd).toBe(0.25);
  });

  it("falls back to preview-order USD and zero fee when no quote", () => {
    const out = buildDepositWalletOption(
      makeOption(POLYGON_CHAIN, POLYGON_USDC, "USDC"),
      null,
      7.5,
    );
    expect(out.required.token.chainId).toBe(POLYGON_CHAIN);
    expect(out.required.usd).toBe(7.5);
    expect(out.fees.usd).toBe(0);
  });
});

describe("deposit option switch binds payment to selected source", () => {
  // Regression: payWithDepositAddress used hydrateOrder alone, which never
  // updates preferredChainId/preferredTokenAddress — every option showed
  // the first option's deposit address. The fabricated wallet option must
  // carry the SELECTED source into the create payload.
  it("fresh create payload reflects each selected option, not the first", () => {
    const forBase = buildCreatePaymentPayload({
      payParams: makePayParams(),
      walletOption: buildDepositWalletOption(
        makeOption(BASE_CHAIN, BASE_USDC, "USDC"),
        makeFees("10.5", "0.25"),
        10,
      ) as unknown as WalletPaymentOption,
    });
    const forPolygon = buildCreatePaymentPayload({
      payParams: makePayParams(),
      walletOption: buildDepositWalletOption(
        makeOption(POLYGON_CHAIN, POLYGON_USDC, "USDC"),
        makeFees("10.5", "0.25"),
        10,
      ) as unknown as WalletPaymentOption,
    });

    expect(forBase.preferredChain).toBe(BASE_CHAIN);
    expect(forBase.preferredTokenAddress).toBe(BASE_USDC);
    expect(forPolygon.preferredChain).toBe(POLYGON_CHAIN);
    expect(forPolygon.preferredTokenAddress).toBe(POLYGON_USDC);
  });
});
