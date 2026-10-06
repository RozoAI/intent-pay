import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { DepositAddressInfo } from "./index";

it("labels deposit addresses with their source token and network", () => {
  const html = renderToStaticMarkup(
    createElement(DepositAddressInfo, {
      depAddr: {
        address: "0x123456789abcdef",
        amount: "10",
        coins: "USDC Base",
        displayToken: null,
        logoURI: "",
        uri: "ethereum:0x123456789abcdef",
        expirationS: Math.floor(Date.now() / 1000) + 300,
      },
      feeData: null,
      refresh: () => {},
      triggerResize: () => {},
    }),
  );

  expect(html).toContain("Network and token: USDC Base. Send only using this network and token.");
  expect(html).toContain("Receiving Address (USDC Base)");
});
