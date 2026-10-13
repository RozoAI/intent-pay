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

## Native coin checkout E2E (rozoDemo)

Standalone checkout specs `checkout-evm-native-to-base` and
`checkout-solana-native-to-base` create a 1.10 USDC exactOut payment to
`E2E_EVM_ADDRESS` on Base. They pay from native ETH (Base, Arbitrum, Ethereum),
BNB (BSC), or SOL and wait for payout completion. Unlike merchant specs, these
use normal `createPayment()` with example appId `rozoDemo`, **not** merchant
order endpoint or OpenRouter payout address. Fund each source wallet with enough
native coin for payment plus gas. From `examples/nextjs-app`:

```sh
pnpm run build
pnpm run start
# In another terminal (with .env.e2e and cached wallets configured):
node e2e/run.cjs checkout-evm-native-to-base
node e2e/run.cjs checkout-solana-native-to-base
```

These specs move real money; use `--grep 'Base ETH'` to run one EVM route.

## Native coin merchant E2E

Merchant native-coin specs live in `examples/nextjs-app/e2e/payment-flows/merchant`.
They create a merchant payId for approximately $1 in local currency, pay it from
an opted-in real wallet, and assert `payment_payout_completed` through
`waitForPayoutCompleted`. These specs move real funds; they stay skipped unless
both `E2E_MERCHANT_APP_ID` and the matching wallet secret are configured.
Merchant endpoint must also enable native pay-in for that app and source chain;
a successful dryrun quote alone does not enable merchant order creation. Current
production endpoint rejects `merchant_openrouter` native pay-in (`pos_*` only),
`pos_rozostudio` lacks native pay-in enablement, and `pos_openrouter` is not
recognized by the configured merchant API yet. Confirm merchant registration,
native enablement, and Base USDC payout before spending funds.

| Source coin | Spec | Wallet gate |
| ----------- | ---- | ----------- |
| ETH on Base, Arbitrum, Ethereum; BNB on BSC | `evm-native.spec.ts` | `E2E_EVM_SEED_PHRASE` |
| SOL | `solana-native.spec.ts` | `E2E_SOLANA_SEED_PHRASE` |

From `examples/nextjs-app`, configure `.env.e2e`, run `pnpm run build && pnpm run start` in another terminal, then run:

```sh
node e2e/run.cjs merchant-evm-native
node e2e/run.cjs merchant-solana-native
```

Each wallet must hold native coin on selected chain for pay-in and gas. Do not
run these in routine checks; running them can spend real money.

## Helper mapping by mode

| Mode     | EVM helper                                                | Solana helper                                            | Stellar helper                                  |
| -------- | --------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------- |
| Bridge   | `payInWithMetaMask(page, mm, { sourceOptionId })`         | `payInWithPhantom(page, ph, { sourceOptionId })`         | `payInWithStellarHeadless(page)`                |
| Checkout | same as Bridge                                            | same as Bridge                                           | same as Bridge                                  |
| Deposit  | `payInWithMetaMask(page, mm, { sourceOptionId, amount })` | `payInWithPhantom(page, ph, { sourceOptionId, amount })` | `payInWithStellarHeadlessDeposit(page, amount)` |
