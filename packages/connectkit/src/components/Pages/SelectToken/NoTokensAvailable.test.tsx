import { polygon, polygonUSDC } from "@rozoai/intent-common";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../hooks/usePayContext", () => ({
  usePayContext: () => ({ triggerResize: vi.fn(), log: vi.fn(), paymentState: {} }),
}));
vi.mock("../../../provider/AnalyticsProvider", () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));

import { NoTokensAvailable } from ".";

const render = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(
    createElement(NoTokensAvailable, {
      onRefresh: async () => {},
      preferredTokens: [polygonUSDC],
      preferredChains: [polygon.chainId],
      canShowAllTokens: true,
      onShowAllTokens: vi.fn(),
      canUseDepositAddress: true,
      onUseDepositAddress: vi.fn(),
      ...over,
    })
  );

describe("NoTokensAvailable", () => {
  it("names the token and chain and shows both exits plus refresh", () => {
    const html = render();
    expect(html).toContain("USDC");
    expect(html).toContain("Polygon");
    expect(html).toContain("in your connected wallet");
    expect(html).toContain("Show all coins in this wallet");
    expect(html).toContain("Send from an exchange or another wallet");
    expect(html).toContain("Refresh balance");
    expect(html.indexOf("Show all coins")).toBeLessThan(html.indexOf("Send from an exchange"));
  });

  it("hides exits that are not allowed and omits the chain clause", () => {
    const html = render({ canShowAllTokens: false, canUseDepositAddress: false, preferredChains: undefined });
    expect(html).not.toContain("Show all coins");
    expect(html).not.toContain("Send from an exchange");
    expect(html).not.toContain("Polygon");
    expect(html).toContain("Refresh balance");
  });
});
