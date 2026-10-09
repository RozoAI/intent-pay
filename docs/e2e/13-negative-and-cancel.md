# Wallet-confirmation boundary & negative cases

Coverage for the parts of a payment that happen **at the wallet** but must not
move money: the amount the wallet is asked to sign, and the bad paths (user
cancels, insufficient balance).

> **No funds are ever moved.** These tests drive the real MetaMask / Phantom
> extensions up to the transaction-confirmation popup and then **reject**. They
> reuse the funded cached profiles only because the SDK's balance gate must pass
> before the wallet popup opens — but nothing is signed or submitted.

## Project

Standalone Playwright project `wallet-cancel`, no dependencies:

```bash
# needs .env.e2e (seeds) + a built wallet cache
pnpm setup-wallets
pnpm dev &            # or set E2E_START_SERVER=1
pnpm test:e2e:wallet-cancel
```

Specs live under `e2e/payment-flows/cancel/`:

| Spec | Source | Cases |
| --- | --- | --- |
| `evm-metamask.spec.ts` | EVM (MetaMask) | amount shown · cancel → Payment Cancelled · retry re-opens popup · insufficient balance |
| `solana-phantom.spec.ts` | Solana (Phantom) | amount shown · cancel → Payment Cancelled · retry re-opens popup |

Skipped unless the relevant seed + destination address are set in `.env.e2e`
(same guards as the real-funds specs).

## How it works

1. **Balance gate first.** The SDK only opens the wallet if the selected token's
   balance covers the required amount (`useWalletPaymentOptions` sets
   `disabledReason = "Balance too low: …"` otherwise). So the funded cached
   wallets are required — but only to get *to* the popup.
2. **Selecting the source token auto-triggers the wallet.** `PayWithToken` fires
   `handleTransfer` ~100 ms after selection — there is no separate in-modal
   "Pay" click. The helpers rely on this.
3. **Rejecting lands on a known state.** Any wallet error (including user
   rejection) sets `PayState.RequestCancelled` → the modal shows a
   **"Payment Cancelled"** heading and a **"Retry Payment"** button
   (`PayWithToken/index.tsx`). The tests assert exactly that, and assert
   *"Payment Completed"* never appears.
4. **Retry re-opens the popup.** `Retry Payment` calls `handleTransfer` again,
   which re-opens the wallet confirmation. The retry test rejects a second time
   so nothing is signed.

## Helpers (`e2e/helpers.ts`)

| Helper | Purpose |
| --- | --- |
| `connectMetaMask` / `connectPhantom` | Pick the wallet, connect, stop at the token list (no token selected). |
| `selectSourceToken` | Select a source option (triggers the wallet popup). |
| `payInWithMetaMaskToWallet` / `payInWithPhantomToWallet` | Full run up to the confirmation popup; **returns the popup page, never confirms**. |
| `waitForMetaMaskConfirmation` / `waitForPhantomConfirmation` | Wait until the popup's cancel button is actionable. |
| `rejectAndExpectCancelled` | Reject in the wallet, then assert the Payment Cancelled state. |
| `clickRetryPayment` | Click "Retry Payment" (a new popup follows). |
| `expectSourceAmount` | Assert the source option advertises the expected amount. |
| `expectSourceInsufficient` | Assert the option is disabled with `Balance too low: …`. |

The existing `payInWithMetaMask` / `payInWithPhantom` now share
`connectMetaMask`/`connectPhantom` + `selectSourceToken` — no duplicated connect
logic between the confirm and cancel paths.

## Amount assertions

The amount is asserted from the **SDK's own source-option title** (e.g.
`0.02 USDC on Base`) via `expectSourceAmount`, not from the wallet DOM. That is
the app-computed amount the wallet will be asked to sign, and it is stable
across MetaMask/Phantom releases. Scraping the extension's confirmation DOM for
the amount is deliberately avoided — it couples the suite to a wallet version.

## Environment

Uses the standard `.env.e2e` (see `02-setup.md`). One optional override:

| Var | Default | What |
| --- | --- | --- |
| `E2E_INSUFFICIENT_AMOUNT` | `1000` | Amount used by the insufficient-balance case. Must exceed the throwaway wallet's balance but stay within the quote API's accepted range. |

## CI

Not part of the nightly real-funds scope, but wired into the workflow as its own
`scope: wallet-cancel` input — it exercises the full xvfb + `setup-wallets` +
chainwright path **without spending**, so it is the safe way to smoke-test the CI
pipeline. Trigger it from **Actions → e2e-chainwright → Run workflow → scope:
wallet-cancel**. It still needs `.env.e2e` secrets and a built wallet cache.

## Why the example app disables React StrictMode

The SDK's auto-transfer effect in `PayWithToken` was **not StrictMode-safe**:
the first dev effect run scheduled the 100 ms transfer timeout and claimed
`autoTransferOrderRef`, StrictMode's cleanup then cleared that timeout, and the
second run returned early on the now-claimed ref — so the wallet request was
never made. Symptom: the modal reaches `PayWithToken` and then goes silent (no
`payState` transition, no chain-RPC call, no popup).

**Root fix:** `packages/connectkit/src/components/Pages/PayWithToken/index.tsx`
now claims the order **inside** the timeout, so the re-armed timer in
StrictMode's second effect run still starts the transfer.

`examples/nextjs-app/next.config.ts` still sets `reactStrictMode: false` because
the example resolves the **published** `@rozoai/intent-pay` (pnpm links it from
the `.pnpm` store, not the workspace), so it does not pick up the in-tree fix
until a new version is published and pinned. Remove the flag then.

## Diagnostics

`logAppConsole(page)` streams the SDK's own `[PayWithToken] payState: …`
transitions into the Playwright log. The cancel specs call it in a
`beforeEach`, so a CI failure shows **where** the payment stopped without needing
the trace artifact (which the workflow deliberately does not upload).

## Known limitations

- **Stellar is not covered.** Its headless in-page signer has no wallet popup to
  cancel; cancellation there is closing the modal, already covered by the mocked
  suite.
- **Requires funded wallets** to clear the balance gate (by design — see above).
  If the Solana source wallet (the address derived from `E2E_SOLANA_SEED_PHRASE`,
  i.e. `E2E_SOLANA_ADDRESS`) holds less USDC than `E2E_AMOUNT`, the Solana specs
  **skip** with an explicit reason instead of failing — fund that address to
  enable them.
- **Retry-after-cancel** depends on the wallet choosing to close its popup on
  rejection (it does for MetaMask and Phantom); if a wallet keeps it open, the
  second `promptPage()` may resurface the same page.
- The insufficient-balance case uses an oversized amount; a wallet holding more
  than `E2E_INSUFFICIENT_AMOUNT` will not trip it.
