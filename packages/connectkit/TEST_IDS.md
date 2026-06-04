# RozoPaySDK — Test ID Inventory

`data-testid` attributes exposed by the SDK for E2E testing, automation, and external apps.

## Convention

Format: `rozopay-{component}-{identifier}`

All testids are stable across patch releases. Breaking changes to testids are treated as semver-minor changes.

## Modal

| `data-testid` | Element | Notes |
|--------------|---------|-------|
| `rozopay-modal` | Root modal container | Present when modal is open. Has `role="dialog"`. |
| `rozopay-modal-overlay` | Background overlay | Click closes the modal (unless backdrop click is disabled). |
| `rozopay-modal-close` | Close (×) button | Always present in modal header. |

## Payment Method Selection

| `data-testid` | Element | Notes |
|--------------|---------|-------|
| `rozopay-options-list` | Options list container | Present on SelectMethod, SelectToken, SelectExchange pages. |
| `rozopay-option-{id}` | Individual option button | `{id}` is the option's stable `id` field. See table below. |

### Static option IDs

| `data-testid` | Payment method |
|--------------|---------------|
| `rozopay-option-connectedWallet` | Currently connected EVM wallet |
| `rozopay-option-connectedSolanaWallet` | Currently connected Solana wallet |
| `rozopay-option-connectedStellarWallet` | Currently connected Stellar wallet |
| `rozopay-option-unconnectedWallet` | EVM wallet (not yet connected) |
| `rozopay-option-stellar` | Stellar payment option |
| `rozopay-option-exchange` | Exchange payment option |
| `rozopay-option-ZKP2P` | ZKP2P payment option |
| `rozopay-option-depositAddress` | Deposit address option |

### Dynamic option IDs (runtime values)

These use runtime values as the `{id}` — not static strings:

| Source | Example `data-testid` | Notes |
|--------|----------------------|-------|
| EVM connector id | `rozopay-option-metaMask` | `connector?.id` from wagmi |
| Solana wallet adapter name | `rozopay-option-Phantom` | `solanaWallet?.adapter.name` |
| Stellar connector id | `rozopay-option-freighter` | `stellarConnector?.id` |

### External payment option IDs

External options use `ExternalPaymentOptions` enum values as IDs:

| `data-testid` | Payment method |
|--------------|---------------|
| `rozopay-option-Coinbase` | Coinbase exchange |
| `rozopay-option-Binance` | Binance exchange |
| `rozopay-option-Lemon` | Lemon exchange |
| `rozopay-option-Venmo` | Venmo (ZKP2P) |
| `rozopay-option-CashApp` | CashApp (ZKP2P) |
| `rozopay-option-MercadoPago` | MercadoPago (ZKP2P) |
| `rozopay-option-Revolut` | Revolut (ZKP2P) |
| `rozopay-option-Wise` | Wise (ZKP2P) |
| `rozopay-option-RampNetwork` | Ramp Network |

## Usage in Playwright

```typescript
// Wait for modal to appear
await expect(page.getByTestId("rozopay-modal")).toBeVisible()

// Click a specific payment method
await page.getByTestId("rozopay-option-connectedWallet").click()

// Close modal via close button
await page.getByTestId("rozopay-modal-close").click()

// Close modal via overlay
await page.getByTestId("rozopay-modal-overlay").click()

// Assert options list is loaded
await expect(page.getByTestId("rozopay-options-list")).toBeVisible()

// Find any option button (prefix match)
const options = page.locator("[data-testid^='rozopay-option-']")
```

## Usage in Cypress

```javascript
cy.get('[data-testid="rozopay-modal"]').should("be.visible")
cy.get('[data-testid="rozopay-option-connectedWallet"]').click()
cy.get('[data-testid="rozopay-modal-close"]').click()
cy.get('[data-testid^="rozopay-option-"]').should("have.length.greaterThan", 0)
```
