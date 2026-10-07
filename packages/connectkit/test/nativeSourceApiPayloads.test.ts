import { describe, expect, it } from "vitest";
import { FeeType } from "@rozoai/intent-common";
import {
  buildCreatePaymentPayload,
  resolveSourceAmountUnits,
  resolveWalletSourceBreakdown,
} from "../src/payment/createPaymentPayload.js";
import { isSamePaymentSource, normalizeSourceTokenAddress } from "../src/utils/token";

/**
 * Regression: the `source.amount` the SDK sends must be the source-token
 * amount from the proxy's `getWalletPaymentOptions`/`getSolana*`/`getStellar*`
 * rows — base units converted with the row's `decimals` — and NEVER the USD
 * amount. The rows below are real API shapes (trimmed) that previously produced
 * the "0.7 ETH for a $0.70 charge" bug.
 *
 * Only `required.token.{chainId,token,decimals}` and `required.amount` matter:
 * `token.usd` / `token.priceFromUsd` are display metadata and are deliberately
 * inconsistent across assets (ETH has usd === priceFromUsd; SOL/XLM carry the
 * inverse), so nothing here may read them.
 */
const DEST = {
  chainId: 8453,
  token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  symbol: "USDC",
  decimals: 6,
  fiatISO: "USD",
};

function buildSourcePayload(
  token: { chainId: number; token: string; symbol: string; decimals: number },
  amount: string,
) {
  return buildCreatePaymentPayload({
    payParams: {
      appId: "test-app",
      toChain: DEST.chainId,
      toToken: DEST.token,
      toAddress: "0xdC4313EfB37836615d820F38A6016EE76598887B",
      toUnits: "1.01",
      feeType: FeeType.ExactIn,
    },
    walletOption: {
      required: { token, amount, usd: 1.01 },
      fees: { usd: 0 },
    } as any,
  });
}

describe("API source rows → outbound source amount/identity", () => {
  it("ETH on Base: wei → ETH, not the USD amount", () => {
    const payload = buildSourcePayload(
      { chainId: 8453, token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "ETH", decimals: 18 },
      "371781421971914",
    );
    expect(payload.preferredAmountUnits).toBe("0.000371781421971914");
    expect(payload.preferredAmountUnits).not.toBe("1.01");
  });

  it("BNB: wei → BNB (the payId row that forced a needless checkout)", () => {
    const payload = buildSourcePayload(
      { chainId: 56, token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE", symbol: "BNB", decimals: 18 },
      "1285510640464312",
    );
    expect(payload.preferredAmountUnits).toBe("0.001285510640464312");
  });

  it("SOL proxy sentinel: lamports → SOL and canonical SOL identity", () => {
    const payload = buildSourcePayload(
      { chainId: 501, token: "11111111111111111111111111111112", symbol: "SOL", decimals: 9 },
      "5769390",
    );
    expect(payload.preferredAmountUnits).toBe("0.00576939");
    expect(payload.preferredChain).toBe(900);
    expect(payload.preferredTokenAddress).toBe("11111111111111111111111111111111");
  });

  it("XLM: stroops (7dp) → XLM", () => {
    const payload = buildSourcePayload(
      { chainId: 1500, token: "XLM", symbol: "XLM", decimals: 7 },
      "32562684",
    );
    expect(payload.preferredAmountUnits).toBe("3.2562684");
  });

  it("Stellar USDC: 7dp units → 0.7", () => {
    const payload = buildSourcePayload(
      {
        chainId: 1500,
        token: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        symbol: "USDC",
        decimals: 7,
      },
      "7000000",
    );
    expect(payload.preferredAmountUnits).toBe("0.7");
  });

  it("Base USDC: 6dp units → 1.01", () => {
    const payload = buildSourcePayload(
      { chainId: 8453, token: DEST.token, symbol: "USDC", decimals: 6 },
      "1010000",
    );
    expect(payload.preferredAmountUnits).toBe("1.01");
  });
});

describe("resolveSourceAmountUnits reads only amount + decimals", () => {
  it("ignores the contradictory SOL usd/priceFromUsd metadata", () => {
    // SOL row: usd 121.33 vs priceFromUsd 0.00824… — neither belongs in the amount.
    expect(
      resolveSourceAmountUnits({
        token: { token: "11111111111111111111111111111112", decimals: 9 },
        amount: "5769390",
        usd: 1.01,
      }),
    ).toBe("0.00576939");
  });
});

describe("isSamePaymentSource — real payment source vs selected option", () => {
  it("BNB payment (backend zeroAddress) matches the proxy 0xEeee option", () => {
    expect(
      isSamePaymentSource(
        { source: { chainId: "56", tokenAddress: "0x0000000000000000000000000000000000000000" } },
        { chainId: 56, token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" },
      ),
    ).toBe(true);
  });

  it("normalizes the two EVM native sentinels to the same identity", () => {
    expect(normalizeSourceTokenAddress(56, "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE")).toBe(
      normalizeSourceTokenAddress(56, "0x0000000000000000000000000000000000000000"),
    );
  });
});

describe("resolveWalletSourceBreakdown — skip getFee when the payment already quoted the source", () => {
  const breakdown = {
    source: { chainId: "56", tokenSymbol: "BNB", amount: "0.00132", fee: "0" },
    destination: { chainId: "8453", tokenSymbol: "USDC", amount: "1.01" },
  } as any;
  const bnbOption = { chainId: 56, token: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" };

  it("returns the stored breakdown when the quote matches the selected source", () => {
    const order = {
      sourceQuote: { amount: "0.0012855", chainId: 56, tokenAddress: "0x0000000000000000000000000000000000000000" },
      paymentBreakdown: breakdown,
    };
    expect(resolveWalletSourceBreakdown(order as any, bnbOption)).toBe(breakdown);
  });

  it("returns undefined when the quote is for a different source", () => {
    const order = {
      sourceQuote: { amount: "1.01", chainId: 8453, tokenAddress: DEST.token },
      paymentBreakdown: breakdown,
    };
    expect(resolveWalletSourceBreakdown(order as any, bnbOption)).toBeUndefined();
  });

  it("returns undefined when there is no quote or breakdown", () => {
    expect(resolveWalletSourceBreakdown(undefined, bnbOption)).toBeUndefined();
    expect(resolveWalletSourceBreakdown({ paymentBreakdown: breakdown } as any, bnbOption)).toBeUndefined();
    expect(
      resolveWalletSourceBreakdown(
        { sourceQuote: { amount: "1", chainId: 56, tokenAddress: "0x0000000000000000000000000000000000000000" } } as any,
        bnbOption,
      ),
    ).toBeUndefined();
  });
});
