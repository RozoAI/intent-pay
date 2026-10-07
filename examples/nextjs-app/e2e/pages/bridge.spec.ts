import { test, expect } from "@playwright/test"
import {
  collectErrors,
  expectHydrated,
  installMockEvmWallet,
  mockWalletCalls,
} from "@rozoai/fe-gate"
import { ALLOW, smokeRoute } from "./_smoke"

smokeRoute("/bridge", {
  pathname: "/bridge",
  title: /Rozo Pay Playground/,
  h1: /Rozo Intent SDK Playground/,
})

test("/bridge Pay Now reaches the wallet provider", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "mobile connect entry differs; desktop provider path covered here"
  )
  const box = collectErrors(page)
  await installMockEvmWallet(page)
  // The preview only renders "Pay Now" once the bridge config is valid, and a
  // fresh context starts with empty toToken/toAddress/toUnits. Seed the
  // playground's persisted config so the button exists without driving the form.
  await page.addInitScript(() => {
    localStorage.setItem(
      "playground-config",
      JSON.stringify({
        toChain: 8453,
        toToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        toAddress: "0x000000000000000000000000000000000000dEaD",
        toUnits: "0.1",
        feeType: "exactIn",
      })
    )
  })
  await page.goto("/bridge")
  await expectHydrated(page, box, {
    allowErrors: ALLOW,
    pathname: "/bridge",
  })

  await page.getByRole("button", { name: /pay now/i }).click()

  // The injected mock wallet auto-connects when the modal opens, so the SDK
  // skips the wallet picker and jumps straight to source-token selection.
  // Asserting the modal plus the provider's account call is the real
  // "reached the wallet provider" signal.
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({
    timeout: 10_000,
  })

  await expect
    .poll(
      async () =>
        (await mockWalletCalls(page)).some(
          (c) =>
            c.method === "eth_requestAccounts" || c.method === "eth_accounts"
        ),
      { timeout: 10_000 }
    )
    .toBe(true)
})
