import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { RecentlyUsedTag } from "../ConnectorList/styles";
import { OptionsList } from ".";
import { FloatingOptionBadge, OptionLabel } from "./styles";

vi.mock("../../../hooks/usePayContext", () => ({
  usePayContext: () => ({ triggerResize: vi.fn(), log: vi.fn() }),
}));

it("floats the wallet picker badge outside the token label", () => {
  const option = {
    id: "test-token",
    title: "0.02 USDC on Ethereum",
    subtitle: "Balance: 0.0478 USDC",
    icons: [],
    onClick: vi.fn(),
  };
  const render = (badge?: string) => renderToStaticMarkup(createElement(OptionsList, {
    isLoading: true,
    options: [{ ...option, badge }],
  }));
  const html = render("Last used");
  expect(html).toContain(RecentlyUsedTag.styledComponentId);
  expect(html).toContain(FloatingOptionBadge.styledComponentId);
  expect(html.indexOf("Last used")).toBeLessThan(html.indexOf(OptionLabel.styledComponentId));
  expect(html.indexOf("Last used")).toBeLessThan(html.indexOf(option.subtitle));
  expect(render()).not.toContain(RecentlyUsedTag.styledComponentId);
});
