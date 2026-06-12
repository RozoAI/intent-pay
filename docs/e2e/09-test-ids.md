# SDK Test IDs

The SDK exposes stable `data-testid` attributes. Use these in your own assertions
and in any custom helpers. The pay-in helpers in `07-helpers.md` already rely on them.

---

## Modal

| `data-testid`           | Element                                         |
| ----------------------- | ----------------------------------------------- |
| `rozopay-modal`         | Payment modal root — assert it opened / closed. |
| `rozopay-modal-overlay` | Backdrop — click to dismiss the modal.          |
| `rozopay-options-list`  | Source method / token list container.           |
| `rozopay-option-{id}`   | Individual option button.                       |

---

## Option ID formats

| Type             | Pattern                              | Example                                                          |
| ---------------- | ------------------------------------ | ---------------------------------------------------------------- |
| Wallet connector | `rozopay-option-{wallet.rdns}`       | `rozopay-option-io.metamask`                                     |
| Wallet connector | `rozopay-option-{wallet.name}`       | `rozopay-option-Phantom`                                         |
| Source token     | `rozopay-option-{chainId}-{address}` | `rozopay-option-8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

**Common source token IDs:**

```
Base USDC   →  rozopay-option-8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
Solana USDC →  rozopay-option-501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```

---

## Selecting options

Click a specific option by exact ID:

```ts
await page.getByTestId("rozopay-option-8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913").click()
```

Filter by token symbol when you don't know the exact address:

```ts
const usdc = page
  .locator("[data-testid^='rozopay-option-']")
  .filter({ hasText: /USDC/i })
  .first()
await usdc.click()
```

Assert the options list rendered before clicking:

```ts
await expect(page.getByTestId("rozopay-options-list").first()).toBeVisible({ timeout: 60_000 })
```

---

See [`TEST_IDS.md`](../../TEST_IDS.md) for the full inventory.
