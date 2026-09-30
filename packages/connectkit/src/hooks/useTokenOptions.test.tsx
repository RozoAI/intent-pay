import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  baseUSDC,
  baseUSDT,
  rozoSolanaUSDC,
  rozoStellarUSDC,
  solana,
  stellar,
} from "@rozoai/intent-common";
import type { SuggestedSource } from "../utils/suggestedSource";
import { useTokenOptions } from "./useTokenOptions";

const context = vi.hoisted(() => ({ suggestedSource: undefined as SuggestedSource | undefined }));
vi.mock("./usePayContext", () => ({
  usePayContext: () => {
    const options = (tokens: typeof baseUSDC[]) => ({
      isLoading: false,
      options: tokens.map((token) => ({
        balance: { token, amount: 10, usd: 10 },
        required: { token, amount: 1 },
      })),
    });
    return {
      paymentState: {
        suggestedSource: context.suggestedSource,
        walletPaymentOptions: options([baseUSDC, baseUSDT]),
        solanaPaymentOptions: options([rozoSolanaUSDC]),
        stellarPaymentOptions: options([rozoStellarUSDC]),
      },
    };
  },
}));
vi.mock("../provider/AnalyticsProvider", () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));
vi.mock("../components/Common/TokenChainLogo", () => ({ default: () => null }));

function badgeIds(suggestion?: SuggestedSource) {
  context.suggestedSource = suggestion;
  let ids: string[] = [];
  function Probe() {
    ids = useTokenOptions("all").optionsList
      .filter((option) => option.badge === "Last used")
      .map((option) => option.id);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  return ids;
}

describe("last-used token indicator", () => {
  it.each([
    [baseUSDC.chainId, baseUSDC],
    [solana.chainId, rozoSolanaUSDC],
    [stellar.chainId, rozoStellarUSDC],
  ])("marks only the matching token for chain %s", (chainId, token) => {
    expect(badgeIds({ chainId, symbol: "usdc" })).toEqual([
      `${token.chainId}-${token.token}`,
    ]);
  });

  it("does not mark tokens for missing, chain-only, or unmatched suggestions", () => {
    expect(badgeIds()).toEqual([]);
    expect(badgeIds({ chainId: baseUSDC.chainId })).toEqual([]);
    expect(badgeIds({ chainId: baseUSDC.chainId, symbol: "UNKNOWN" })).toEqual([]);
  });
});
