import { describe, expect, it } from "vitest";
import { parseUnits } from "viem";
import {
  resolveWalletPaymentAmount,
  withWalletSourceQuote,
} from "../src/payment/createPaymentPayload.js";

const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";

const walletOption = {
  required: {
    token: {
      chainId: 56,
      token: BSC_USDT,
      decimals: 6,
    },
    // Stale pre-checkout quote from Order A.
    usd: 49.52,
  },
} as any;

describe("resolveWalletPaymentAmount", () => {
  it("uses hydrated API source amount, not stale wallet quote", () => {
    const hydratedOrder = withWalletSourceQuote(
      {} as any,
      {
        source: {
          amount: "49.95",
          chainId: 56,
          tokenAddress: BSC_USDT,
        },
      } as any,
    );

    expect(resolveWalletPaymentAmount(hydratedOrder, walletOption)).toBe(parseUnits("49.95", 6));
  });

  it("accepts the API's canonical Solana chain ID", () => {
    const option = {
      required: {
        token: {
          chainId: 501,
          token: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          decimals: 6,
        },
      },
    } as any;
    const hydratedOrder = withWalletSourceQuote(
      {} as any,
      {
        source: {
          amount: "49.95",
          chainId: 900,
          tokenAddress: option.required.token.token,
        },
      } as any,
    );

    expect(resolveWalletPaymentAmount(hydratedOrder, option)).toBe(
      parseUnits("49.95", 6),
    );
  });

  it("accepts the API's canonical Stellar chain ID", () => {
    const option = {
      required: {
        token: {
          chainId: 10001,
          token: "USDC:GBBD47IFOB2C2ILJV6OZVYIIQBUQZ3VSAZJLF5CV3MELN4VYOK4ZYUZN",
          decimals: 7,
        },
      },
    } as any;
    const hydratedOrder = withWalletSourceQuote(
      {} as any,
      {
        source: {
          amount: "49.1234567",
          chainId: 1500,
          tokenAddress: option.required.token.token,
        },
      } as any,
    );

    expect(resolveWalletPaymentAmount(hydratedOrder, option)).toBe(
      parseUnits("49.1234567", 7),
    );
  });

  it("preserves Stellar token precision from the hydrated quote", () => {
    const option = {
      required: {
        token: {
          chainId: 1500,
          token: "USDC:GBBD47IFOB2C2ILJV6OZVYIIQBUQZ3VSAZJLF5CV3MELN4VYOK4ZYUZN",
          decimals: 7,
        },
      },
    } as any;
    const hydratedOrder = withWalletSourceQuote(
      {} as any,
      {
        source: {
          amount: "49.1234567",
          chainId: 1500,
          tokenAddress: option.required.token.token,
        },
      } as any,
    );

    expect(resolveWalletPaymentAmount(hydratedOrder, option)).toBe(
      parseUnits("49.1234567", 7),
    );
  });

  it("rejects a hydrated quote for another source token", () => {
    const hydratedOrder = {
      sourceQuote: {
        amount: "49.95",
        chainId: 56,
        tokenAddress: "0x0000000000000000000000000000000000000001",
      },
    } as any;

    expect(() => resolveWalletPaymentAmount(hydratedOrder, walletOption)).toThrow(
      "does not match selected token",
    );
  });
});
