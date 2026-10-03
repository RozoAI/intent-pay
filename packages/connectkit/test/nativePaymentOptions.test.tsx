import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  baseETH,
  baseUSDC,
  bscBNB,
  FeeType,
  polygonPOL,
  rozoSolana,
  RozoPayOrderMode,
  solanaSOL,
  stellarXLM,
  TokenSymbol,
  type WalletPaymentOption,
} from "@rozoai/intent-common";
import { ethAddress } from "viem";
import { useDepositAddressOptions } from "../src/hooks/useDepositAddressOptions";
import { useSolanaPaymentOptions } from "../src/hooks/useSolanaPaymentOptions";
import { useStellarPaymentOptions } from "../src/hooks/useStellarPaymentOptions";
import { useWalletPaymentOptions } from "../src/hooks/useWalletPaymentOptions";
import {
  convertPreferredSymbolsToTokens,
  getSourcePaymentToken,
  normalizeSourceTokenAddress,
} from "../src/utils/token";
import type { PayParams } from "../src/payment/paymentFsm";
import type { TrpcClient } from "../src/utils/trpc";

type Query = { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> };
const state = vi.hoisted(() => ({
  data: undefined as unknown,
  query: undefined as Query | undefined,
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: (query: Query) => {
    state.query = query;
    return { data: state.data, isLoading: false, refetch: vi.fn(), error: null };
  },
}));

const params = (appId: string, preferredTokens?: PayParams["preferredTokens"]): PayParams => ({
  appId,
  toChain: baseUSDC.chainId,
  toToken: baseUSDC.token,
  feeType: FeeType.ExactOut,
  preferredTokens,
});
const option = (token: typeof baseETH, usd = 2): WalletPaymentOption => {
  const amount = { token, amount: "1000000000000000000", usd };
  return { required: amount, balance: amount, minimumRequired: amount, fees: amount };
};
const proxyEth = option({ ...baseETH, token: ethAddress });
const proxySol = option({ ...solanaSOL, chainId: 501, token: "11111111111111111111111111111112" });

function renderOptions<T>(useOptions: () => T): T {
  let result: T;
  function Probe() {
    result = useOptions();
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return result!;
}

beforeEach(() => {
  state.data = undefined;
  state.query = undefined;
});

describe("native source identity", () => {
  it("includes EVM natives in default symbol choices without changing supportedTokens", () => {
    const defaults = convertPreferredSymbolsToTokens(undefined, undefined)!;
    for (const token of [baseETH, bscBNB, polygonPOL]) {
      expect(defaults).toContainEqual(token);
    }
    expect(convertPreferredSymbolsToTokens([TokenSymbol.ETH], undefined)).toContainEqual(baseETH);
    expect(convertPreferredSymbolsToTokens(undefined, [baseUSDC])).toEqual([baseUSDC]);
    expect(normalizeSourceTokenAddress(baseETH.chainId, ethAddress)).toBe(baseETH.token);
    expect(normalizeSourceTokenAddress(rozoSolana.chainId, proxySol.required.token.token)).toBe(
      solanaSOL.token,
    );
    expect(
      normalizeSourceTokenAddress(
        rozoSolana.chainId,
        "So11111111111111111111111111111111111111112",
      ),
    ).not.toBe(solanaSOL.token);
    expect(getSourcePaymentToken(8453, ethAddress)).toBe(baseETH);
    expect(getSourcePaymentToken(900, "11111111111111111111111111111112")).toBe(solanaSOL);
    expect(
      getSourcePaymentToken(900, "So11111111111111111111111111111111111111112"),
    ).toBeUndefined();
    expect(getSourcePaymentToken(1500, "XLM")).toBe(stellarXLM);
  });

  it("shows an opted-in EVM native response only when caller allows it", () => {
    state.data = [proxyEth, option(baseUSDC)];
    const render = (preferredTokens?: PayParams["preferredTokens"]) =>
      renderOptions(() =>
        useWalletPaymentOptions({
          trpc: {} as TrpcClient,
          address: "0x0000000000000000000000000000000000000001",
          destChainId: 8453,
          usdRequired: 0.02,
          isDepositFlow: false,
          payParams: params("merchant", preferredTokens),
          log: () => {},
        }),
      ).options;
    expect(render()).toHaveLength(2);
    expect(render([baseUSDC])).toHaveLength(1);
    expect(render([baseETH]).map((o) => o.balance.token.symbol)).toEqual(["ETH"]);
    state.data = [option({ ...baseETH, chainId: 999 })];
    expect(render()).toEqual([]);
  });

  it("preserves proxy balance reason and never renders undefined for native ETH", () => {
    const eth = {
      ...proxyEth,
      balance: { ...proxyEth.balance, amount: "850000000000000", usd: 2.337585603873379 },
      disabledReason: "Balance too low: $2.34",
    };
    const render = () =>
      renderOptions(() =>
        useWalletPaymentOptions({
          trpc: {} as TrpcClient,
          address: "0x0000000000000000000000000000000000000001",
          destChainId: 8453,
          usdRequired: 5,
          isDepositFlow: false,
          payParams: params("merchant"),
          log: () => {},
        }),
      ).options[0];

    state.data = [eth];
    expect(render().disabledReason).toBe("Balance too low: 0.00085 ETH (~$2.34)");
    state.data = [{ ...eth, disabledReason: undefined }];
    expect(render().disabledReason).toBe("Balance too low: 0.00085 ETH (~$2.34)");
    state.data = [{ ...eth, disabledReason: "Payment unavailable" }];
    expect(render().disabledReason).toBe("Payment unavailable");
    state.data = [{ ...option(baseUSDC, 1.59), disabledReason: "Balance too low: $1.59" }];
    expect(render().disabledReason).toBe("Balance too low: $1.59");
    state.data = [
      {
        ...eth,
        balance: { ...eth.balance, amount: "1", usd: 0.000001 },
        disabledReason: undefined,
      },
    ];
    expect(render().disabledReason).toBe("Balance too low: 0.000000000000000001 ETH (~$0)");
  });

  it("sends native source sentinel as an EVM ranking hint, not a filter", async () => {
    const query = vi.fn().mockResolvedValue([]);
    renderOptions(() =>
      useWalletPaymentOptions({
        trpc: { getWalletPaymentOptions: { query } } as unknown as TrpcClient,
        address: "0x0000000000000000000000000000000000000001",
        destChainId: 8453,
        usdRequired: 0.02,
        isDepositFlow: false,
        payParams: params("merchant", [baseETH]),
        log: () => {},
      }),
    );
    await state.query!.queryFn();
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({
        appId: "merchant",
        preferredTokens: [{ chain: 8453, address: ethAddress }],
        preferredTokenAddress: [ethAddress],
      }),
    );
  });

  it("sends deposit appId independently and keys cache by merchant", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const trpc = { getDepositAddressOptions: { query } } as unknown as TrpcClient;
    const render = (appId: string) =>
      renderOptions(() =>
        useDepositAddressOptions({
          trpc,
          usdRequired: 0.02,
          mode: RozoPayOrderMode.SALE,
          payParams: params(appId),
        }),
      );
    render("merchant-a");
    const first = state.query!;
    await first.queryFn();
    expect(query).toHaveBeenCalledWith({ appId: "merchant-a", usdRequired: 0.02, mode: "sale" });
    render("merchant-b");
    expect(state.query!.queryKey).not.toEqual(first.queryKey);
    await state.query!.queryFn();
    expect(query).toHaveBeenLastCalledWith({
      appId: "merchant-b",
      usdRequired: 0.02,
      mode: "sale",
    });
  });

  it("matches native deposit preferences across proxy and SDK sentinels", () => {
    state.data = [
      { chainId: 8453, token: { ...baseETH, token: ethAddress } },
      {
        chainId: 501,
        token: { ...solanaSOL, chainId: 501, token: "11111111111111111111111111111112" },
      },
      { chainId: 1500, token: { ...stellarXLM, chainId: 1500, token: "XLM" } },
    ];
    const result = renderOptions(() =>
      useDepositAddressOptions({
        trpc: {} as TrpcClient,
        usdRequired: 0.02,
        mode: RozoPayOrderMode.SALE,
        payParams: params("merchant", [
          baseETH,
          { ...solanaSOL, chainId: rozoSolana.chainId },
          stellarXLM,
        ]),
      }),
    );
    expect(result.options).toHaveLength(3);
    expect(result.options[1].token.token).toBe(solanaSOL.token);
    const restricted = renderOptions(() =>
      useDepositAddressOptions({
        trpc: {} as TrpcClient,
        usdRequired: 0.02,
        mode: RozoPayOrderMode.SALE,
        payParams: params("merchant", [baseUSDC]),
      }),
    );
    expect(restricted.options).toEqual([]);
  });

  it("keeps Stellar XLM across proxy and common identity aliases", async () => {
    state.data = [option({ ...stellarXLM, chainId: 1500, token: "XLM" })];
    const query = vi.fn().mockResolvedValue([]);
    const result = renderOptions(() =>
      useStellarPaymentOptions({
        trpc: { getStellarPaymentOptions: { query } } as unknown as TrpcClient,
        address: "GTEST",
        usdRequired: 0.02,
        isDepositFlow: false,
        payParams: params("merchant", [stellarXLM]),
      }),
    );
    expect(result.options).toHaveLength(1);
    await state.query!.queryFn();
    expect(query).toHaveBeenCalledWith(
      expect.objectContaining({ preferredTokenAddress: undefined }),
    );
  });

  it("shows native SOL balance and USD without hiding a non-balance error", () => {
    const sol = {
      ...proxySol,
      balance: { ...proxySol.balance, amount: "120000000", usd: 2.34 },
      disabledReason: "Balance too low: $2.34",
    };
    const render = () =>
      renderOptions(() =>
        useSolanaPaymentOptions({
          trpc: {} as TrpcClient,
          address: "solana-wallet",
          usdRequired: 5,
          isDepositFlow: false,
          payParams: params("merchant", [{ ...solanaSOL, chainId: rozoSolana.chainId }]),
        }),
      ).options[0];
    state.data = [sol];
    expect(render().disabledReason).toBe("Balance too low: 0.12 SOL (~$2.34)");
    state.data = [
      { ...sol, balance: { ...sol.balance, amount: "0.012985327" }, disabledReason: undefined },
    ];
    expect(render().disabledReason).toBe("Balance too low: 0.012985327 SOL (~$2.34)");
    state.data = [{ ...sol, disabledReason: "Payment unavailable" }];
    expect(render().disabledReason).toBe("Payment unavailable");
  });

  it("shows native XLM balance and USD", () => {
    state.data = [
      {
        ...option({ ...stellarXLM, chainId: 1500, token: "XLM" }),
        balance: {
          token: { ...stellarXLM, chainId: 1500, token: "XLM" },
          amount: "1234567",
          usd: 0.03,
        },
        disabledReason: "Balance too low: $0.03",
      },
    ];
    const result = renderOptions(() =>
      useStellarPaymentOptions({
        trpc: {} as TrpcClient,
        address: "GTEST",
        usdRequired: 5,
        isDepositFlow: false,
        payParams: params("merchant", [stellarXLM]),
      }),
    );
    expect(result.options[0].disabledReason).toBe("Balance too low: 0.1234567 XLM (~$0.03)");
  });

  it("normalizes only native SOL from legacy proxy options", () => {
    state.data = [proxySol];
    const result = renderOptions(() =>
      useSolanaPaymentOptions({
        trpc: {} as TrpcClient,
        address: "solana-wallet",
        usdRequired: 0.02,
        isDepositFlow: false,
        payParams: params("merchant", [{ ...solanaSOL, chainId: rozoSolana.chainId }]),
      }),
    );
    expect(result.options).toHaveLength(1);
    expect(result.options[0].required.token.token).toBe(solanaSOL.token);
    expect(result.options[0].balance.token.token).toBe(solanaSOL.token);
  });
});
