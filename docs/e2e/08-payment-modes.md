# Payment Modes

The SDK supports three modes. Pay-in and completion steps are **identical across
all three** — only the "open modal" step differs, and that step is app-specific.

---

## Bridge

Amount is set upfront in your UI via the `toUnits` prop. The SDK displays and
locks the amount when the modal opens.

**Open the modal:** render `<RozoPayButton />` (or call `openRozoPayModal()`)
with `toUnits` set, then click it.

**Test sequence:**

```
[Stellar source only] useStellarSigner(page, secret)  ← before navigation
↓
navigate to your payment page
↓
click your "Pay Now" button
↓
assert rozopay-modal is visible                        ← modal open
↓
payInWith{MetaMask | Phantom | StellarHeadless}(page, ...)
↓
waitForPayoutCompleted(page)
```

---

## Checkout

A `payId` is created server-side before the modal opens. The modal reads the
amount from the order — it's locked and cannot be changed by the user.

**Open the modal:** call `createPayment()` from the SDK (or your own backend),
store the `payId`, then open the modal with it. Your UI's amount field is
typically read-only once the order exists.

**Test sequence:**

```
[Stellar source only] useStellarSigner(page, secret)  ← before navigation
↓
navigate to your checkout page
↓
trigger order creation — wait for payId to be returned
↓
wait for "Pay Now" button to become active
↓
click "Pay Now"
↓
assert rozopay-modal is visible                        ← modal open
↓
payInWith{MetaMask | Phantom | StellarHeadless}(page, ...)
↓
waitForPayoutCompleted(page)
```

---

## Deposit

No amount is set upfront. The SDK renders an amount input **inside the modal**
after the user picks a source token. Minimum deposit: **0.1 USDC**.

**Open the modal:** render `<RozoPayButton />` without `toUnits`, then click it.

**Test sequence:**

```
[Stellar source only] useStellarSigner(page, secret)  ← before navigation
↓
navigate to your deposit page
↓
click your "Deposit" button (no amount set upfront)
↓
assert rozopay-modal is visible                        ← modal open
↓
payInWithMetaMask(page, metamask, { sourceOptionId, amount: "0.1" })
  — or —
payInWithPhantom(page, phantom, { sourceOptionId, amount: "0.1" })
  — or —
payInWithStellarHeadlessDeposit(page, "0.1")
↓
waitForPayoutCompleted(page)
```

The `amount` is passed to the helper (not your form) because the SDK collects
it inside the modal after token selection via `enterDepositAmount`.

---

## Helper mapping by mode

| Mode     | EVM helper                                                | Solana helper                                            | Stellar helper                                  |
| -------- | --------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Bridge   | `payInWithMetaMask(page, mm, { sourceOptionId })`         | `payInWithPhantom(page, ph, { sourceOptionId })`         | `payInWithStellarHeadless(page)`                |
| Checkout | same as Bridge                                            | same as Bridge                                           | same as Bridge                                  |
| Deposit  | `payInWithMetaMask(page, mm, { sourceOptionId, amount })` | `payInWithPhantom(page, ph, { sourceOptionId, amount })` | `payInWithStellarHeadlessDeposit(page, amount)` |
