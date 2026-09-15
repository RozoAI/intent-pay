import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import {
  resolveWalletPaymentAmount,
  withWalletSourceQuote,
} from "../src/payment/createPaymentPayload.js";

const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";

const walletOption = {
  required: {
    token: { chainId: 56, token: BSC_USDT, decimals: 6 },
    usd: 49.52,
  },
} as any;

describe("resolveWalletPaymentAmount", () => {
  it("uses hydrated API source amount, not stale wallet quote", () => {
    const hydratedOrder = withWalletSourceQuote(
      {} as any,
      { source: { amount: "49.95", chainId: 56, tokenAddress: BSC_USDT } } as any,
    );

    expect(resolveWalletPaymentAmount(hydratedOrder, walletOption)).toBe(parseUnits("49.95", 6));
  });

  it("accepts canonical Solana and Stellar chain aliases", () => {
    const solanaOption = {
      required: {
        token: { chainId: 501, token: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
      },
    } as any;
    const stellarOption = {
      required: {
        token: {
          chainId: 10001,
          token: "USDC:GBBD47IFOB2C2ILJV6OZVYIIQBUQZ3VSAZJLF5CV3MELN4VYOK4ZYUZN",
          decimals: 7,
        },
      },
    } as any;

    expect(resolveWalletPaymentAmount(withWalletSourceQuote({} as any, {
      source: { amount: "49.95", chainId: 900, tokenAddress: solanaOption.required.token.token },
    } as any), solanaOption)).toBe(parseUnits("49.95", 6));
    expect(resolveWalletPaymentAmount(withWalletSourceQuote({} as any, {
      source: { amount: "49.1234567", chainId: 1500, tokenAddress: stellarOption.required.token.token },
    } as any), stellarOption)).toBe(parseUnits("49.1234567", 7));
  });

  it("preserves six-decimal hydrated source precision", () => {
    const hydratedOrder = withWalletSourceQuote(
      {} as any,
      { source: { amount: "1001.000001", chainId: 56, tokenAddress: BSC_USDT } } as any,
    );

    expect(resolveWalletPaymentAmount(hydratedOrder, walletOption)).toBe(parseUnits("1001.000001", 6));
  });

  it("rejects missing or mismatched hydrated source quotes", () => {
    expect(() => resolveWalletPaymentAmount({} as any, walletOption)).toThrow("has no source quote");
    expect(() => resolveWalletPaymentAmount({ sourceQuote: {
      amount: "49.95", chainId: 56, tokenAddress: "0x0000000000000000000000000000000000000001",
    } } as any, walletOption)).toThrow("does not match selected token");
  });
});
