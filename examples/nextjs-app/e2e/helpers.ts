import { type Page, expect } from "@playwright/test"

/** Navigate to a playground mode and wait for config aside to hydrate */
export async function gotoMode(page: Page, mode: "bridge" | "checkout" | "deposit") {
  await page.goto(`/${mode}`)
  await expect(page.locator("aside").first()).toBeVisible({ timeout: 15_000 })
}

/**
 * Select a value from a Radix Select component by label text.
 * Radix renders a combobox trigger + portal listbox — not a native <select>.
 */
export async function selectRadixOption(page: Page, labelText: string | RegExp, optionText: string) {
  const label = page.getByText(labelText, { exact: false })
  const group = page.locator("div").filter({ has: label }).last()
  const combobox = group.getByRole("combobox").first()
  await combobox.scrollIntoViewIfNeeded()
  await combobox.click()
  await page.getByRole("option", { name: optionText, exact: false }).click()
}

/**
 * Fill the Bridge/Deposit config form.
 * Uses human-readable values: chainName ("Base"), tokenSymbol ("USDC").
 */
export async function fillConfig(
  page: Page,
  opts: { chainName: string; tokenSymbol: string; address: string; amount?: string }
) {
  await selectRadixOption(page, "Destination Chain", opts.chainName)
  await selectRadixOption(page, "Destination Token", opts.tokenSymbol)
  await page.getByPlaceholder(/EVM address|address/i).fill(opts.address)
  if (opts.amount !== undefined) {
    await page.getByPlaceholder(/e\.g\. 1|amount/i).fill(opts.amount)
  }
}

/** Click Confirm and wait until Pay Now is enabled */
export async function confirmAndWait(page: Page) {
  await page.getByRole("button", { name: /confirm/i }).click()
  await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({ timeout: 20_000 })
}

/** Click Pay Now and wait for SDK modal */
export async function openModal(page: Page) {
  await page.getByRole("button", { name: /pay now/i }).click()
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({ timeout: 10_000 })
}

/** Close modal via Escape key */
export async function closeModalEscape(page: Page) {
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
}

/** Close modal by clicking the overlay backdrop */
export async function closeModalBackdrop(page: Page) {
  await page.getByTestId("rozopay-modal-overlay").click({ force: true, position: { x: 5, y: 5 } })
  await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({ timeout: 5_000 })
}
