import { expect, test } from "@playwright/test"
import {
  closeModalBackdrop,
  closeModalEscape,
  fillConfig,
  gotoMode,
} from "./helpers"

const CFG = {
  chainName: "Base",
  tokenSymbol: "USDC",
  address: "0x000000000000000000000000000000000000dEaD",
  // no amount — deposit mode doesn't take upfront amount
}

/** Click Deposit and wait for SDK modal */
async function openDepositModal(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /deposit/i }).click()
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({ timeout: 10_000 })
}

test.describe("Deposit mode — config form", () => {
  test("Deposit button is not shown before config is filled", async ({ page }) => {
    await gotoMode(page, "deposit")
    await expect(
      page.getByText("Fill in all fields to enable the deposit button.")
    ).toBeVisible()
  })

  test("Confirm button is disabled when form is pristine", async ({ page }) => {
    await gotoMode(page, "deposit")
    await expect(page.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  test("filling config enables Confirm button (no amount field)", async ({ page }) => {
    await gotoMode(page, "deposit")
    // Deposit form has no amount field — only chain/token/address
    await fillConfig(page, CFG)
    await expect(page.getByRole("button", { name: /confirm/i })).toBeEnabled()
  })

  test("no amount input is shown in the config form", async ({ page }) => {
    await gotoMode(page, "deposit")
    await expect(page.getByPlaceholder(/e\.g\. 1|amount/i)).not.toBeVisible()
  })
})

test.describe("Deposit mode — after confirm", () => {
  test.beforeEach(async ({ page }) => {
    await gotoMode(page, "deposit")
    await fillConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    // Wait for Applying → Deposit enabled
    await expect(
      page.getByRole("button", { name: /applying|deposit/i })
    ).toBeVisible({ timeout: 5_000 })
    await expect(
      page.getByRole("button", { name: /deposit/i })
    ).toBeEnabled({ timeout: 20_000 })
  })

  test("Deposit button is enabled after confirm", async ({ page }) => {
    await expect(page.getByRole("button", { name: /deposit/i })).toBeEnabled()
  })

  test("modal opens on Deposit click", async ({ page }) => {
    await openDepositModal(page)
    await expect(page.getByTestId("rozopay-modal")).toBeVisible()
  })

  test("modal has role=dialog", async ({ page }) => {
    await openDepositModal(page)
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("modal closes on Escape", async ({ page }) => {
    await openDepositModal(page)
    await page.keyboard.press("Escape")
    await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
  })

  test("modal closes on overlay backdrop click", async ({ page }) => {
    await openDepositModal(page)
    await closeModalBackdrop(page)
    await expect(page.getByTestId("rozopay-modal")).not.toBeVisible()
  })

  test("modal renders options list after loading", async ({ page }) => {
    await openDepositModal(page)
    await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })
  })

  test("modal shows at least one payment option", async ({ page }) => {
    await openDepositModal(page)
    await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })
    const options = page.locator("[data-testid^='rozopay-option-']")
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThan(0)
  })

  test("Deposit re-enabled after closing modal", async ({ page }) => {
    await openDepositModal(page)
    await closeModalEscape(page)
    await expect(page.getByRole("button", { name: /deposit/i })).toBeEnabled()
  })
})

test.describe("Deposit mode — event log", () => {
  test("event log shows empty state before any deposit", async ({ page }) => {
    await gotoMode(page, "deposit")
    await fillConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    await expect(page.getByRole("button", { name: /deposit/i })).toBeEnabled({ timeout: 20_000 })
    await expect(
      page.getByText("Events will appear here as you complete payment steps.")
    ).toBeVisible()
  })
})
