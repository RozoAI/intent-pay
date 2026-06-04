import { expect, test } from "@playwright/test"
import {
  closeModalBackdrop,
  closeModalEscape,
  confirmAndWait,
  fillConfig,
  gotoMode,
  openModal,
} from "./helpers"

const CFG = {
  chainName: "Base",
  tokenSymbol: "USDC",
  address: "0x000000000000000000000000000000000000dEaD",
  amount: "1",
}

test.describe("Bridge mode — config form", () => {
  test("Pay Now is not shown before config is confirmed", async ({ page }) => {
    await gotoMode(page, "bridge")
    await expect(page.getByRole("button", { name: /pay now/i })).not.toBeVisible()
    await expect(page.getByText("Fill in all fields to enable the payment button.")).toBeVisible()
  })

  test("Confirm button is disabled when form is pristine", async ({ page }) => {
    await gotoMode(page, "bridge")
    await expect(page.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  test("filling config enables Confirm button", async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillConfig(page, CFG)
    await expect(page.getByRole("button", { name: /confirm/i })).toBeEnabled()
  })

  test("Confirm shows Applying state then enables Pay Now", async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    // resetPayment() call shows transient "Applying…" while in progress
    // Allow either: loading state appears briefly, or Pay Now is already enabled (fast network)
    await expect(
      page.getByRole("button", { name: /applying|pay now/i })
    ).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({ timeout: 20_000 })
  })
})

test.describe("Bridge mode — modal", () => {
  test.beforeEach(async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillConfig(page, CFG)
    await confirmAndWait(page)
  })

  test("modal opens on Pay Now click", async ({ page }) => {
    await openModal(page)
    await expect(page.getByTestId("rozopay-modal")).toBeVisible()
  })

  test("modal has role=dialog", async ({ page }) => {
    await openModal(page)
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("modal closes on Escape", async ({ page }) => {
    await openModal(page)
    await closeModalEscape(page)
    await expect(page.getByTestId("rozopay-modal")).not.toBeVisible()
  })

  test("modal closes on overlay backdrop click", async ({ page }) => {
    await openModal(page)
    await closeModalBackdrop(page)
    await expect(page.getByTestId("rozopay-modal")).not.toBeVisible()
  })

  test("modal renders options list after loading", async ({ page }) => {
    await openModal(page)
    await expect(page.getByTestId("rozopay-options-list")).toBeVisible({ timeout: 25_000 })
  })

  test("modal shows at least one payment option button", async ({ page }) => {
    await openModal(page)
    await expect(page.getByTestId("rozopay-options-list")).toBeVisible({ timeout: 25_000 })
    const options = page.locator("[data-testid^='rozopay-option-']")
    await expect(options.first()).toBeVisible({ timeout: 25_000 })
    expect(await options.count()).toBeGreaterThan(0)
  })

  test("Pay Now re-enabled after closing modal", async ({ page }) => {
    await openModal(page)
    await closeModalEscape(page)
    await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled()
  })
})

test.describe("Bridge mode — event log", () => {
  test("event log shows empty state before any payment", async ({ page }) => {
    await gotoMode(page, "bridge")
    await fillConfig(page, CFG)
    await confirmAndWait(page)
    await expect(page.getByText("Events will appear here as you complete payment steps.")).toBeVisible()
  })
})
