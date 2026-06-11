# RozoPaySDK — Test ID Inventory

`data-testid` attributes exposed by the SDK for E2E testing, automation, and external apps.

## Convention

Format: `rozopay-{component}-{identifier}`

All testids are stable across patch releases. Breaking changes to testids are treated as semver-minor changes.

> New to E2E testing the SDK? See [`E2E_INTEGRATION.md`](./E2E_INTEGRATION.md) for a
> full guide to wiring up EVM / Solana / Stellar payment tests with Playwright + chainwright.

## Modal

| `data-testid`           | Element              | Notes                                                       |
| ----------------------- | -------------------- | ----------------------------------------------------------- |
| `rozopay-modal`         | Root modal container | Present when modal is open. Has `role="dialog"`.            |
| `rozopay-modal-overlay` | Background overlay   | Click closes the modal (unless backdrop click is disabled). |
| `rozopay-modal-close`   | Close (×) button     | Always present in modal header.                             |

## Payment Method Selection

| `data-testid`          | Element                  | Notes                                                       |
| ---------------------- | ------------------------ | ----------------------------------------------------------- |
| `rozopay-options-list` | Options list container   | Present on SelectMethod, SelectToken, SelectExchange pages. |
| `rozopay-option-{id}`  | Individual option button | `{id}` is the option's stable `id` field. See tables below. |

### Static option IDs

| `data-testid`                           | Payment method                     | Notes                                                                      |
| --------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `rozopay-option-connectedWallet`        | Currently connected EVM wallet     | Present when an EVM wallet is already connected.                           |
| `rozopay-option-connectedSolanaWallet`  | Currently connected Solana wallet  | Present when a Solana wallet is already connected.                         |
| `rozopay-option-connectedStellarWallet` | Currently connected Stellar wallet | Present when a Stellar wallet (e.g. headless signer) is already connected. |
| `rozopay-option-unconnectedWallet`      | EVM wallet (not yet connected)     | Generic "Pay with wallet" entry when no EVM wallet is connected.           |
| `rozopay-option-stellar`                | Stellar payment option             | Always present when Stellar is an allowed payment method.                  |
| `rozopay-option-depositAddress`         | Deposit address option             | Present when deposit-address payment is available.                         |

### Dynamic option IDs — wallet connectors (runtime values)

These use runtime values as `{id}` — not static strings.

| Source                     | Example `data-testid`        | Notes                                                            |
| -------------------------- | ---------------------------- | ---------------------------------------------------------------- |
| EVM connector id (wagmi)   | `rozopay-option-io.metamask` | Value of `connector?.id`; use the id shown in your wagmi config. |
| Solana wallet adapter name | `rozopay-option-Phantom`     | Value of `solanaWallet?.adapter.name`.                           |
| Stellar connector id       | `rozopay-option-freighter`   | Value of `stellarConnector?.id`.                                 |

### Dynamic option IDs — source tokens (runtime values)

Selectable source tokens on the SelectToken screen use `{chainId}-{tokenAddress}` as the id.

| Source              | Example `data-testid`                                             | Notes                                            |
| ------------------- | ----------------------------------------------------------------- | ------------------------------------------------ |
| EVM source token    | `rozopay-option-8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`  | Base USDC: chainId `8453`, token address.        |
| Solana source token | `rozopay-option-501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | Native Solana USDC: chainId `501`, mint address. |

The full format is `rozopay-option-{chainId}-{tokenAddress}`. Other EVM chains follow the same pattern.

## Usage in Playwright

```typescript
// Wait for modal to appear
await expect(page.getByTestId("rozopay-modal")).toBeVisible()

// Close modal via overlay backdrop
await page.getByTestId("rozopay-modal-overlay").click({ force: true, position: { x: 5, y: 5 } })

// Assert options list is loaded
await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 25_000 })

// Find any option button (prefix match)
const options = page.locator("[data-testid^='rozopay-option-']")
await expect(options.first()).toBeVisible()

// Click a specific wallet connector
await page.getByTestId("rozopay-option-io.metamask").click()
await page.getByTestId("rozopay-option-Phantom").click()

// Select a specific source token (EVM Base USDC)
const sourceOption = page.getByTestId("rozopay-option-8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
await expect(sourceOption).toBeVisible({ timeout: 120_000 })
await expect(sourceOption).toBeEnabled({ timeout: 10_000 })
await sourceOption.click()

// Select a specific source token (Solana USDC)
const solanaOption = page.getByTestId("rozopay-option-501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
await expect(solanaOption).toBeVisible({ timeout: 120_000 })
await solanaOption.click()

// Find a source token by symbol when the exact testid is unknown
const usdcOption = page
  .locator("[data-testid^='rozopay-option-']")
  .filter({ hasText: /USDC/i })
  .first()
await expect(usdcOption).toBeVisible({ timeout: 60_000 })
await usdcOption.click()
```
