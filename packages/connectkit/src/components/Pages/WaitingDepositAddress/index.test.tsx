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

const evmAddr = "0x1111111111111111111111111111111111111111";
function render(depAddr: Record<string, unknown>, expired = false) {
  return renderToStaticMarkup(
    createElement(DepositAddressInfo, {
      depAddr: {
        amount: "10",
        displayToken: null,
        logoURI: "",
        uri: "x",
        expirationS: Math.floor(Date.now() / 1000) + (expired ? -10 : 300),
        ...depAddr,
      } as any,
      feeData: null,
      refresh: () => {},
      triggerResize: () => {},
    }),
  );
}

it("names the only network above an EVM address and says not to pay again below it", () => {
  const html = render({ address: evmAddr, coins: "USDC Base", onlyOn: "USDC on Base" });
  expect(html).toContain("Send USDC on Base only");
  expect(html).not.toContain("Network and token:");
  expect(html).toContain("Already sent on another chain? Don&#x27;t pay again. We detect it automatically.");
  expect(html.indexOf("Send USDC on Base only")).toBeLessThan(html.indexOf("Already sent on another chain?"));
});

it("keeps the network line but makes no cross-chain promise for non-EVM addresses", () => {
  const sol = render({ address: "So1anaTestAddre55111111111111111111111111", coins: "USDC Solana", onlyOn: "USDC on Solana" });
  expect(sol).toContain("Send USDC on Solana only");
  expect(sol).not.toContain("Already sent on another chain?");
  const xlm = render({ address: "G" + "A".repeat(55), memo: "123", coins: "USDC Stellar", onlyOn: "USDC on Stellar", isStellarClassic: true });
  expect(xlm).toContain("Send USDC on Stellar only");
  expect(xlm).not.toContain("Already sent on another chain?");
});

it("drops the already-sent line once the address has expired", () => {
  const html = render({ address: evmAddr, coins: "USDC Base", onlyOn: "USDC on Base" }, true);
  expect(html).not.toContain("Already sent on another chain?");
});
