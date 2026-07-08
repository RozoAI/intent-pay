import { type Locator, type Page, type TestInfo, expect } from "@playwright/test"
import type { Metamask } from "chainwright/metamask"
import type { Phantom } from "chainwright/phantom"
import { E2E_STELLAR_WALLET_NAME } from "../lib/e2e-stellar-constants"

/**
 * Attach a per-test payment summary to the Playwright report — rendered for
 * every outcome (passed / failed / skipped / timed out). Call once per spec,
 * ideally right after the payId is known, so the id is captured even if a later
 * step fails.
 *
 * Two built-in surfaces, no custom reporter:
 *  - annotations → the key/value rows at the top of each test's detail view.
 *  - attach()    → a "payment-summary" JSON blob, clickable in the HTML report.
 *
 * `status` is the final outcome you know at call time; testInfo.status (set by
 * Playwright after the test body returns) is also folded in so the attachment
 * always reflects pass/fail even when the caller passes "unknown".
 */
export async function reportPayment(
  testInfo: TestInfo,
  info: {
    payId?: string
    /** e.g. "Base → USDC on Base" or the source→dest pair. */
    route?: string
    /** Final payment state you observed, if any. */
    status?: string
    /** Anything else worth surfacing (amounts, chain ids, notes). */
    extra?: Record<string, unknown>
  }
) {
  const push = (type: string, description?: string) => {
    if (description) testInfo.annotations.push({ type, description })
  }
  push("Payment ID", info.payId)
  push("Route", info.route)
  push("Payment status", info.status)

  const summary = {
    project: testInfo.project.name,
    title: testInfo.title,
    // testInfo.status is undefined during the body; the reporter re-reads the
    // attachment after the run, by which point Playwright has set it.
    outcome: testInfo.status ?? "running",
    payId: info.payId ?? null,
    route: info.route ?? null,
    status: info.status ?? null,
    ...info.extra,
  }
  await testInfo.attach("payment-summary", {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  })
}

/**
 * Click a locator only if it shows up within `timeout`. Used for optional UI
 * branches (e.g. the wallet chain picker, which the SDK skips when only one
 * chain is offered). Best-effort: silently no-ops if the element never appears.
 */
async function clickIfVisible(locator: Locator, timeout = 5_000) {
  try {
    await locator.click({ timeout })
  } catch {
    // Optional step — element didn't appear, nothing to click.
  }
}

/** Navigate to a playground mode and wait for config aside to hydrate */
export async function gotoMode(
  page: Page,
  mode: "bridge" | "checkout" | "deposit"
) {
  await page.goto(`/${mode}`)
  await expect(page.locator("aside").first()).toBeVisible({ timeout: 15_000 })
}

/**
 * Select a value from a Radix Select component by label text.
 * Radix renders a combobox trigger + portal listbox — not a native <select>.
 */
export async function selectRadixOption(
  page: Page,
  labelText: string | RegExp,
  optionText: string
) {
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
  opts: {
    chainName: string
    tokenSymbol: string
    address: string
    amount?: string
  }
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
  await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({
    timeout: 20_000,
  })
}

/** Click Pay Now and wait for SDK modal */
export async function openModal(page: Page) {
  await page.getByRole("button", { name: /pay now/i }).click()
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({
    timeout: 10_000,
  })
}

/** Close modal via Escape key */
export async function closeModalEscape(page: Page) {
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({
    timeout: 5_000,
  })
}

/** Close modal by clicking the overlay backdrop */
export async function closeModalBackdrop(page: Page) {
  await page
    .getByTestId("rozopay-modal-overlay")
    .click({ force: true, position: { x: 5, y: 5 } })
  await expect(page.getByTestId("rozopay-modal")).not.toBeVisible({
    timeout: 5_000,
  })
}

// ─── High-level bridge flow steps (shared across payment-flow specs) ──────────

/**
 * Configure a Bridge payment and open the SDK modal, leaving it on the
 * "choose a payment method" screen — ready for a source-specific pay-in step.
 */
export async function startBridgePayment(
  page: Page,
  opts: {
    destChain: string
    destToken: string
    address: string
    amount: string
  }
) {
  await gotoMode(page, "bridge")
  await fillConfig(page, {
    chainName: opts.destChain,
    tokenSymbol: opts.destToken,
    address: opts.address,
    amount: opts.amount,
  })
  await page.getByRole("button", { name: /confirm/i }).click()
  await expect(page.getByRole("button", { name: /pay now/i })).toBeEnabled({
    timeout: 20_000,
  })
  await openModal(page)
}

/**
 * Configure a Checkout (payId) payment and open the SDK modal.
 *
 * Unlike Bridge, Checkout creates the order server-side first: fill config →
 * Confirm → "Create Payment" (calls createPayment(), returns a payId) → "Pay
 * Now". The amount is locked into the created payment, so the in-modal pay-in
 * steps are identical to Bridge.
 */
export async function startCheckoutPayment(
  page: Page,
  opts: {
    destChain: string
    destToken: string
    address: string
    amount: string
  }
) {
  await gotoMode(page, "checkout")
  await fillConfig(page, {
    chainName: opts.destChain,
    tokenSymbol: opts.destToken,
    address: opts.address,
    amount: opts.amount,
  })
  await page.getByRole("button", { name: /confirm/i }).click()

  // Confirm reveals "Create Payment"; clicking it calls the createPayment() API
  // and swaps in a payId-backed "Pay Now" button.
  const createPayment = page.getByRole("button", { name: /create payment/i })
  await expect(createPayment).toBeVisible({ timeout: 10_000 })
  await createPayment.click()

  await expect(page.getByRole("button", { name: /pay now/i })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText(/payment id:/i)).toBeVisible()
  await openModal(page)
}

/**
 * Create a merchant payId via the merchant endpoint, then open the SDK modal in
 * Checkout mode against it.
 *
 * Unlike Checkout mode, the destination (chain/token/receiver) is fixed by the
 * merchant's server-side config — the request only supplies the local amount and
 * a source hint. We POST to `/payment-api/payments/merchant`, take `response.id`
 * as the payId, and drive it through the checkout page's "Enter Payment ID
 * manually" input. The in-modal pay-in steps are then identical to Bridge.
 *
 * Returns the created payId so callers can assert/log it.
 */
export async function startMerchantCheckout(
  page: Page,
  opts: {
    apiUrl: string
    appId: string
    amountLocal: string
    currencyLocal: string
    /** Source chainId + token symbol hint for the merchant order (e.g. Base USDC). */
    source: { chainId: string; tokenSymbol: string }
  }
) {
  const res = await page.request.post(
    `${opts.apiUrl}/payment-api/payments/merchant`,
    {
      headers: { "content-type": "application/json" },
      data: {
        appId: opts.appId,
        amount_local: opts.amountLocal,
        currency_local: opts.currencyLocal,
        source: {
          chainId: opts.source.chainId,
          tokenSymbol: opts.source.tokenSymbol,
        },
      },
    }
  )
  if (!res.ok()) {
    throw new Error(
      `Merchant payment create failed: ${res.status()} ${await res.text()}`
    )
  }
  const body = (await res.json()) as { id?: string }
  const payId = body.id
  if (!payId) throw new Error(`Merchant response missing id: ${JSON.stringify(body)}`)

  // Reuse the checkout page's manual payId path — no config form to fill, since
  // the merchant order already locks destination + amount server-side.
  await gotoMode(page, "checkout")
  await page
    .getByPlaceholder(/xxxxxxxx-xxxx|payment id/i)
    .fill(payId)
  await page.getByRole("button", { name: /^use$/i }).click()

  await expect(page.getByText(/payment id:/i)).toBeVisible({ timeout: 10_000 })
  await openModal(page)

  // The modal's SELECT_METHOD wires each wallet's chain options (e.g. Phantom's
  // Solana adapter) only AFTER the payId's order loads — `showSolanaPaymentMethod`
  // gates on `pay.order != null` (usePaymentState). In the merchant/payId flow the
  // order round-trips getPayment() async, so a fast click on "Pay with wallet"
  // races the fetch: Phantom connects EVM-only with no Solana chain picker.
  // "Pay with Stellar" is gated on the same loaded order, so waiting for it proves
  // the order resolved and the multi-chain wallet entries are hydrated.
  await expect(
    page.getByRole("button", { name: /pay with stellar/i })
  ).toBeVisible({ timeout: 30_000 })

  return payId
}

/**
 * Configure a Deposit payment and open the SDK modal.
 *
 * Deposit takes no upfront amount — only destination chain/token/address. After
 * Confirm, the "Deposit" button opens the modal directly (there's no separate
 * Pay Now). The user enters how much to deposit INSIDE the modal, so callers
 * must drive the amount via enterDepositAmount during the pay-in step.
 */
export async function startDepositPayment(
  page: Page,
  opts: {
    destChain: string
    destToken: string
    address: string
  }
) {
  await gotoMode(page, "deposit")
  // Deposit config form has no amount field.
  await fillConfig(page, {
    chainName: opts.destChain,
    tokenSymbol: opts.destToken,
    address: opts.address,
  })
  await page.getByRole("button", { name: /confirm/i }).click()

  // Confirm calls resetPayment() (transient "Applying…") then enables Deposit.
  const depositBtn = page.getByRole("button", { name: /^deposit$/i })
  await expect(depositBtn).toBeEnabled({ timeout: 20_000 })
  await depositBtn.click()
  await expect(page.getByTestId("rozopay-modal")).toBeVisible({
    timeout: 10_000,
  })
}

/**
 * Enter the deposit amount on the SDK's in-modal amount screen, then continue.
 *
 * Deposit mode passes no toUnits, so the SDK renders an amount input
 * (placeholder "0.00") with a Continue button. For the Stellar pay-in path this
 * screen appears AFTER selecting the source token (SELECT_TOKEN →
 * STELLAR_SELECT_AMOUNT), so call this right after the token is chosen.
 */
export async function enterDepositAmount(page: Page, amount: string) {
  const amountInput = page.getByPlaceholder("0.00")
  await expect(amountInput).toBeVisible({ timeout: 30_000 })
  await amountInput.fill(amount)
  const continueBtn = page.getByRole("button", { name: /continue/i })
  await expect(continueBtn).toBeEnabled({ timeout: 10_000 })
  await continueBtn.click()
}

/**
 * Pay in via the MetaMask extension (chainwright): pick wallet + chain, connect,
 * select the source token, and confirm the on-chain transaction.
 *
 * Pass `amount` for Deposit flows: after the token is selected the SDK shows an
 * in-modal amount screen (SELECT_AMOUNT) before the wallet confirmation, since
 * deposit sets no upfront toUnits.
 */
export async function payInWithMetaMask(
  page: Page,
  metamask: Metamask,
  opts: { sourceOptionId: string; amount?: string }
) {
  await page.getByRole("button", { name: /pay with wallet/i }).click()
  await page.getByRole("button", { name: /metamask/i }).click()

  // Multi-chain wallets show an Ethereum/Solana chain picker — but only when the
  // payment allows both chains. When only EVM is offered (e.g. some Checkout
  // payIds) the SDK connects directly and skips this screen, so the pick is
  // best-effort.
  await clickIfVisible(page.getByRole("button", { name: /ethereum/i }))

  // chainwright's connectToApp() can throw a benign "target closed" when
  // MetaMask auto-closes the popup right after Connect (v13.x). The options-list
  // assertion below is the real proof the wallet connected, so swallow only that.
  try {
    await metamask.connectToApp()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/closed/i.test(msg)) throw err
  }

  // Source token list can re-render as the connection settles — wait for the
  // specific option, not just the list container.
  const sourceOption = page.getByTestId(`rozopay-option-${opts.sourceOptionId}`)
  await expect(sourceOption).toBeVisible({ timeout: 120_000 })
  await expect(sourceOption).toBeEnabled({ timeout: 10_000 })
  await sourceOption.click()

  if (opts.amount != null) {
    await enterDepositAmount(page, opts.amount)
  }

  await metamask.confirmTransaction()
}

/**
 * Unlock Phantom only if its lock screen is showing. chainwright's unlock()
 * blindly fills the password field, so it hangs ~30s when the cached profile is
 * already unlocked (which Phantom's freshly-built profile usually is).
 */
export async function unlockPhantomIfNeeded(
  phantom: Phantom,
  phantomPage: Page
) {
  const locked = await phantomPage.locator("input[name='password']").isVisible()
  if (locked) await phantom.unlock()
}

/**
 * Pay in via the Phantom extension (chainwright): pick wallet + Solana chain,
 * connect, select the source token, and confirm the on-chain transaction.
 * Mirrors payInWithMetaMask — Phantom is multi-chain, so a chain-selection step
 * appears after picking the wallet.
 *
 * Pass `amount` for Deposit flows: after the token is selected the SDK shows an
 * in-modal amount screen (SOLANA_SELECT_AMOUNT) before the wallet confirmation,
 * since deposit sets no upfront toUnits.
 */
export async function payInWithPhantom(
  page: Page,
  phantom: Phantom,
  opts: { sourceOptionId: string; amount?: string }
) {
  await page.getByRole("button", { name: /pay with wallet/i }).click()
  await page.getByRole("button", { name: /phantom/i }).click()
  // Phantom supports EVM + Solana → the SDK shows a chain picker, but only when
  // both chains are offered. Best-effort: skip if it connects directly.
  await clickIfVisible(page.getByRole("button", { name: /solana/i }))

  // connectToApp() can throw a benign "target closed" when Phantom auto-closes
  // the popup right after approval. The options-list assertion below is the real
  // proof the wallet connected, so swallow only that.
  try {
    await phantom.connectToApp()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (!/closed/i.test(msg)) throw err
  }

  // Source token list can re-render as the connection settles — wait for the
  // specific option, not just the list container.
  const sourceOption = page.getByTestId(`rozopay-option-${opts.sourceOptionId}`)
  await expect(sourceOption).toBeVisible({ timeout: 120_000 })
  await expect(sourceOption).toBeEnabled({ timeout: 10_000 })
  await sourceOption.click()

  if (opts.amount != null) {
    await enterDepositAmount(page, opts.amount)
  }

  await phantom.confirmTransaction()
}

/**
 * Choose which Stellar wallet the in-page headless signer uses, by injecting
 * its secret key before the app loads. Lets a test pick any pool wallet as the
 * source without a rebuild.
 *
 * MUST be called before navigation (uses addInitScript). The app reads this in
 * app/providers.tsx, preferring it over the build-time NEXT_PUBLIC_ fallback.
 */
export async function useStellarSigner(page: Page, secret: string) {
  await page.addInitScript((s) => {
    ;(
      window as Window & { __E2E_STELLAR_SECRET__?: string }
    ).__E2E_STELLAR_SECRET__ = s
  }, secret)
}

/**
 * Pay in via the headless Stellar signer: pick "Pay with Stellar", select the
 * injected headless wallet, then the source USDC token. Signing + submission
 * happen automatically in-page (no popup).
 */
export async function payInWithStellarHeadless(page: Page) {
  await page.getByRole("button", { name: /pay with stellar/i }).click()
  await page
    .getByText(E2E_STELLAR_WALLET_NAME, { exact: false })
    .first()
    .click()

  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({
    timeout: 60_000,
  })
  const usdcOption = page
    .locator("[data-testid^='rozopay-option-']")
    .filter({ hasText: /USDC/i })
    .first()
  await expect(usdcOption).toBeVisible({ timeout: 60_000 })
  await usdcOption.click()
}

/**
 * Deposit-mode variant of the headless Stellar pay-in: same wallet + token
 * selection, but because Deposit sets no upfront amount, the SDK shows an
 * in-modal amount screen after the source token is picked. Enter the amount
 * there, then signing + submission happen automatically in-page (no popup).
 */
export async function payInWithStellarHeadlessDeposit(
  page: Page,
  amount: string
) {
  await page.getByRole("button", { name: /pay with stellar/i }).click()
  await page
    .getByText(E2E_STELLAR_WALLET_NAME, { exact: false })
    .first()
    .click()

  await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({
    timeout: 60_000,
  })
  const usdcOption = page
    .locator("[data-testid^='rozopay-option-']")
    .filter({ hasText: /USDC/i })
    .first()
  await expect(usdcOption).toBeVisible({ timeout: 60_000 })
  await usdcOption.click()

  // Deposit flow: SELECT_TOKEN → STELLAR_SELECT_AMOUNT. Enter how much to send.
  await enterDepositAmount(page, amount)
}

/**
 * Wait until the cross-chain PAYOUT completes — not just the payin.
 *
 * Confirmation screen states:
 *   "Confirming..."     → payin tx still settling
 *   "Payment Confirmed" → payin done, payout still processing
 *   "Payment Completed" → payout resolved (final state)
 */
export async function waitForPayoutCompleted(page: Page, timeout = 8 * 60_000) {
  await expect(
    page.getByText("Payment Completed", { exact: true })
  ).toBeVisible({
    timeout,
  })
  await expect(page.getByText(/processing payout/i)).toBeHidden()
}
