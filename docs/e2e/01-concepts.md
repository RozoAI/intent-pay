# Concepts

## Two halves of every test

Every payment test has two distinct phases:

**1. Open the modal** — app-specific.
Navigate to your payment page, fill your form, click your "Pay" button.
The steps depend entirely on your UI. The only contract: `rozopay-modal` must
be visible when this phase ends.

**2. Pay in and wait for completion** — SDK-specific, identical across all Rozo apps.
From modal open onward, every step is driven through the SDK's stable
`data-testid` attributes. Copy the helpers in [07-helpers.md](./07-helpers.md)
verbatim — they work without modification in any Rozo app.

This boundary is the key design decision. Keep app-specific code out of the
shared helpers; keep SDK interaction out of your app code.

---

## Signing strategy per chain

Each source chain uses a deliberate strategy:

| Source chain              | Strategy                                    | Why                                                                                              |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **EVM** (Base, Ethereum…) | Real **MetaMask** extension via chainwright | SDK connects EVM wallets through wagmi connectors; chainwright automates the extension popups.   |
| **Solana**                | Real **Phantom** extension via chainwright  | SDK auto-detects Solana wallets via the Wallet Standard; Phantom is a real Standard wallet.      |
| **Stellar**               | **Headless in-page signer** (no extension)  | SDK accepts an injectable `stellarKit` prop, so a secret-key signer runs in-page with no popups. |

A single wallet can serve both roles depending on flow direction. The EVM wallet
is the source for EVM→Stellar and the destination for Stellar→EVM.

---

## Payment modes

Three modes differ only in how you open the modal. Pay-in and completion are
identical across all three. See [08-payment-modes.md](./08-payment-modes.md) for
step-by-step sequences.

| Mode         | Amount                                    | Modal opens via                            |
| ------------ | ----------------------------------------- | ------------------------------------------ |
| **Bridge**   | Set upfront in your UI                    | "Pay Now" button with `toUnits` set        |
| **Checkout** | Locked into a server-side order (`payId`) | "Pay Now" after `createPayment()` resolves |
| **Deposit**  | Entered inside the modal                  | "Deposit" button with no `toUnits`         |
