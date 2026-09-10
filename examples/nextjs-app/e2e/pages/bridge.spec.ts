import { test, expect } from "@playwright/test";
import {
  collectErrors,
  expectHydrated,
  installMockEvmWallet,
  mockWalletCalls,
} from "@rozoai/fe-gate";
import { ALLOW, smokeRoute } from "./_smoke";

smokeRoute("/bridge", {
  pathname: "/bridge",
  title: /Rozo Pay Playground/,
  h1: /Rozo Intent SDK Playground/,
});

test("/bridge Pay Now reaches the wallet provider", async ({ page, isMobile }) => {
  test.skip(isMobile, "mobile connect entry differs; desktop provider path covered here");
  const box = collectErrors(page);
  await installMockEvmWallet(page);
  await page.goto("/bridge");
  await expectHydrated(page, box, {
    allowErrors: ALLOW,
    pathname: "/bridge",
  });

  await page.getByRole("button", { name: /pay now/i }).click();
  const wallet = page
    .getByRole("button", {
      name: /metamask|injected|mock wallet|browser wallet|connect/i,
    })
    .first();
  await expect(wallet).toBeVisible({ timeout: 10_000 });
  await wallet.click();

  await expect
    .poll(
      async () =>
        (await mockWalletCalls(page)).some(
          (c) => c.method === "eth_requestAccounts" || c.method === "eth_accounts",
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
});
