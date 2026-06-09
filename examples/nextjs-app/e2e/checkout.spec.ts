import { expect, test } from "@playwright/test"
import {
  closeModalBackdrop,
  closeModalEscape,
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

test.describe("Checkout mode — config form", () => {
  test("Create Payment is not shown before config is confirmed", async ({ page }) => {
    await gotoMode(page, "checkout")
    await expect(page.getByRole("button", { name: /create payment/i })).not.toBeVisible()
    await expect(
      page.getByText("Fill in configuration fields to use Create Payment")
    ).toBeVisible()
  })

  test("Confirm button is disabled when form is pristine", async ({ page }) => {
    await gotoMode(page, "checkout")
    await expect(page.getByRole("button", { name: /confirm/i })).toBeDisabled()
  })

  test("filling config enables Confirm button", async ({ page }) => {
    await gotoMode(page, "checkout")
    await fillConfig(page, CFG)
    await expect(page.getByRole("button", { name: /confirm/i })).toBeEnabled()
  })

  test("Confirm shows Create Payment button", async ({ page }) => {
    await gotoMode(page, "checkout")
    await fillConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    await expect(page.getByRole("button", { name: /create payment/i })).toBeVisible({
      timeout: 10_000,
    })
  })
})

test.describe("Checkout mode — Create Payment API flow", () => {
  test.beforeEach(async ({ page }) => {
    await gotoMode(page, "checkout")
    await fillConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    await expect(page.getByRole("button", { name: /create payment/i })).toBeVisible({
      timeout: 10_000,
    })
  })

  test("clicking Create Payment transitions to Pay Now state", async ({ page }) => {
    await page.getByRole("button", { name: /create payment/i }).click()
    // Either loading state or Pay Now directly
    await expect(
      page.getByRole("button", { name: /creating payment|pay now/i })
    ).toBeVisible({ timeout: 5_000 })
    await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 30_000 })
  })

  test("Payment ID is shown after creation", async ({ page }) => {
    await page.getByRole("button", { name: /create payment/i }).click()
    await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/payment id:/i)).toBeVisible()
  })

  test("Use different payment resets to Create Payment view", async ({ page }) => {
    await page.getByRole("button", { name: /create payment/i }).click()
    await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 30_000 })
    await page.getByRole("button", { name: /use different payment/i }).click()
    await expect(page.getByRole("button", { name: /create payment/i })).toBeVisible()
  })
})

test.describe("Checkout mode — manual Payment ID", () => {
  test.beforeEach(async ({ page }) => {
    await gotoMode(page, "checkout")
  })

  test("Use button is disabled when input is empty", async ({ page }) => {
    await expect(page.getByRole("button", { name: /^use$/i })).toBeDisabled()
  })

  test("entering a payment ID and clicking Use shows Pay Now", async ({ page }) => {
    // Use a plausible UUID-shaped ID; API will fail but UI shows Pay Now optimistically
    const fakeId = "00000000-0000-0000-0000-000000000001"
    await page.getByPlaceholder(/xxxx/i).fill(fakeId)
    await page.getByRole("button", { name: /^use$/i }).click()
    await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 10_000 })
  })

  test("pressing Enter in payment ID input triggers Use", async ({ page }) => {
    const fakeId = "00000000-0000-0000-0000-000000000002"
    await page.getByPlaceholder(/xxxx/i).fill(fakeId)
    await page.keyboard.press("Enter")
    await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 10_000 })
  })
})

test.describe("Checkout mode — modal (via Create Payment)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoMode(page, "checkout")
    await fillConfig(page, CFG)
    await page.getByRole("button", { name: /confirm/i }).click()
    await expect(page.getByRole("button", { name: /create payment/i })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole("button", { name: /create payment/i }).click()
    await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({ timeout: 30_000 })
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
    await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })
  })

  test("modal shows at least one payment option", async ({ page }) => {
    await openModal(page)
    await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })
    const options = page.locator("[data-testid^='rozopay-option-']")
    await expect(options.first()).toBeVisible()
    expect(await options.count()).toBeGreaterThan(0)
  })

  test("Pay Now re-enabled after closing modal", async ({ page }) => {
    await openModal(page)
    await closeModalEscape(page)
    await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled()
  })
})

test.describe("Checkout mode — event log", () => {
  test("event log shows empty state before any payment", async ({ page }) => {
    await gotoMode(page, "checkout")
    await expect(
      page.getByText("Events will appear here as you complete payment steps.")
    ).toBeVisible()
  })
})
