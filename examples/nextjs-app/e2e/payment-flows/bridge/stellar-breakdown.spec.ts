import { expect, test, type Page } from "@playwright/test"
import { E2E } from "../../env"
import {
  fillConfig,
  gotoMode,
  openModal,
  selectRadixOption,
  useStellarSigner,
} from "../../helpers"
import { E2E_STELLAR_WALLET_NAME } from "../../../lib/e2e-stellar-constants"

const DESTINATION = "0x000000000000000000000000000000000000dEaD"
const STELLAR_USDC_BALANCE_USD = 2_000

const cases: Array<{
  name: string
  feeType: "Exact input" | "Exact output"
}> = [
  { name: "exact input", feeType: "Exact input" },
  { name: "exact output", feeType: "Exact output" },
]

function replaceStellarUsdcBalance(value: unknown): boolean {
  if (!value || typeof value !== "object") return false

  if (Array.isArray(value)) {
    return value.some(replaceStellarUsdcBalance)
  }

  const record = value as Record<string, unknown>
  const balance = record.balance as
    | { usd?: unknown; token?: { symbol?: unknown; chainId?: unknown } }
    | undefined
  if (
    balance?.token?.symbol === "USDC" &&
    String(balance.token.chainId) === "1500"
  ) {
    balance.usd = STELLAR_USDC_BALANCE_USD
    return true
  }

  return Object.values(record).some(replaceStellarUsdcBalance)
}

async function mockStellarBalance(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request()
    if (!request.postData()?.includes("getStellarPaymentOptions")) {
      await route.continue()
      return
    }

    const response = await route.fetch()
    const body = (await response.json()) as unknown
    if (!replaceStellarUsdcBalance(body)) {
      throw new Error(
        "Stellar USDC balance missing from getStellarPaymentOptions"
      )
    }
    await route.fulfill({ response, json: body })
  })

  // Let getFee hit backend, then stop createPayment before it can create a row
  // or reach Stellar signing/submission.
  await page.route("**/payment-api", () => new Promise<void>(() => {}))
}

function displayAmount(amount: string): string {
  return amount.includes(".") ? amount.replace(/\.?0+$/, "") : amount
}

test.describe("Bridge: Stellar USDC payment breakdown", () => {
  test.skip(!E2E.stellar.secret, "Set E2E_STELLAR_SECRET in .env.e2e")

  for (const scenario of cases) {
    test(`${scenario.name} shows mocked large-balance quote`, async ({
      page,
    }) => {
      await useStellarSigner(page, E2E.stellar.secret!)
      await mockStellarBalance(page)

      await gotoMode(page, "bridge")
      await fillConfig(page, {
        chainName: "Base",
        tokenSymbol: "USDC",
        address: DESTINATION,
        amount: "2000",
      })
      await selectRadixOption(page, "Fee Type", scenario.feeType)
      await page.getByRole("button", { name: /confirm/i }).click()
      await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled()
      await openModal(page)

      await page.getByRole("button", { name: /pay with stellar/i }).click()
      await page
        .getByText(E2E_STELLAR_WALLET_NAME, { exact: false })
        .first()
        .click()

      const usdc = page
        .locator("[data-testid^='rozopay-option-']")
        .filter({ hasText: /USDC/i })
        .first()
      await expect(usdc).toBeEnabled({ timeout: 60_000 })
      const feeResponse = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return (
          url.pathname.endsWith("/payment-api/payments") &&
          url.searchParams.get("dryrun") === "true" &&
          response.ok()
        )
      })
      await usdc.click()

      const quote = (await feeResponse).json() as Promise<{
        source: { tokenSymbol: string; amount: string; fee: string }
        destination: { tokenSymbol: string; amount: string }
      }>
      const fee = await quote
      const modal = page.getByTestId("rozopay-modal")
      await expect(modal.getByText("Fees")).toBeVisible()
      await expect(
        modal.getByText(
          `${displayAmount(fee.source.fee)} ${fee.source.tokenSymbol}`
        )
      ).toBeVisible()
      await expect(modal.getByText("Receives")).toBeVisible()
      await expect(
        modal.getByText(
          `${displayAmount(fee.destination.amount)} ${fee.destination.tokenSymbol}`
        )
      ).toBeVisible()
      await expect(modal.getByText("You Pay")).toBeVisible()
      await expect(
        modal.getByText(
          `${displayAmount(fee.source.amount)} ${fee.source.tokenSymbol}`
        )
      ).toBeVisible()
    })
  }
})
