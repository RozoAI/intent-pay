# Plan: `consumerOwnsWallets` — SDK read-only wallet mode

Status: **DESIGN / NOT IMPLEMENTED**. Code changes reverted pending sign-off on this doc.

## Goal (one line)

Add a consumer-facing `consumerOwnsWallets?: boolean` prop that makes the SDK
**read-only on wallets**: it never connects or disconnects a wallet, so clicking
any "switch wallet" surface can never tear down the consumer app's own session
(which shares the same wagmi / Solana / Stellar instance).

## Why this exists

The consumer app provides its own 3-chain wallet connect. Because the SDK and
consumer share the **same** wagmi/adapter instance, a connected wallet shows up
automatically in the SDK. Today the SDK's "Pay with another wallet" option calls
`disconnectAll()` (`SelectMethod/index.tsx:380`), which disconnects EVM (wagmi),
Solana, and Stellar together — silently logging the consumer app out of its own
wallet with no user action inside it.

This is the same root cause already patched for Stellar only, via
`isStellarExternalKit` (`SelectMethod/index.tsx:412`). `consumerOwnsWallets`
generalizes that fix to all chains.

## Scope decision (locked)

**Option (a) — suppress-all** was chosen (the other options were hide-switch-only
and per-chain-granularity). Under `consumerOwnsWallets` the SDK:

- hides "Pay with another wallet" / "Pay with Stellar" entry points,
- suppresses every SDK wallet connect/disconnect path (CONNECTORS / CONNECT,
  SwitchNetworks disconnect, Solana "Try Again" disconnect),
- keeps the consumer's connected-wallet tiles (so the user can still *pay* with
  them),
- keeps **Deposit Address / Exchange** fully available (the user explicitly
  required this).

`preferredChains` / `preferredTokens` remain safe to use alongside — they only
rank/filter the already-connected wallet's tokens; they never trigger a connect
or disconnect.

## All wallet touch points (grounded)

| # | File:line | Surface | Destructive? | Action under flag |
|---|-----------|---------|-------------|-------------------|
| 1 | `SelectMethod/index.tsx:380` | "Pay with another wallet" `onClick` | yes (EVM+Sol+Stellar) | hide option |
| 2 | `SelectMethod/index.tsx:412` | "Pay with Stellar" gate | yes (gated `isStellarExternalKit`) | extend gate |
| 3 | `SelectAnotherMethodButton/index.tsx` (rendered in 5 pages) | "Pay with another method" / "Pay with another wallet" | nav only | `return null` |
| 4 | `ConnectorSolana/index.tsx:123` | "Try Again" `solanaWallets.disconnect()` | yes (Solana) | skip disconnect |
| 5 | `SwitchNetworks/index.tsx:28` | wrong-chain `disconnect()` + `reset()` | yes (EVM) | hide button |
| 6 | `SelectToken/index.tsx:153` | redirect → `SELECT_METHOD` if required chain missing | nav, **dead-ends** | skip redirect |
| 7 | `MobileConnectors/index.tsx:95,109` | `setUserDisconnected(false)` | state | no change (harmless) |

Pages reached only from the hidden entries (CONNECTORS, CONNECT, MOBILECONNECTORS)
become unreachable and need **no** edit.

## Edge cases already considered

- **#6 dead-end**: the `SelectToken` redirect sends a user with a missing chain
  to `SELECT_METHOD`, which under the flag lacks the switch — stuck. Skip the
  redirect when `consumerOwnsWallets`.
- **Per-chain gap**: `isStellarExternalKit` is per-chain; `consumerOwnsWallets`
  is all-or-nothing. Fine for the target use case (consumer owns all 3). If a
  future consumer owns only some chains, this needs a per-chain shape — out of
  scope, noted as `?`.
- **#4 "Try Again"**: Solana connect failure retries via `disconnect()`. Under
  the flag we just `select()` without disconnecting.
- **Connected-but-wrong-chain**: consumer connected only Ethereum, payment needs
  Solana. With switch hidden, only Deposit Address / Exchange remain — wallet path
  dead. Acceptable for embedded flows; document it.
- **Compose**: must AND with `connectedWalletOnly` (already hides the gateway)
  and OR with `isStellarExternalKit` (already hides Stellar). No conflict.
- **Auto-navigate (Race A)**: still jumps to `SELECT_TOKEN` using the consumer's
  connected wallet — desired.
- **`Error` "Try Another Method"**: nav-only (→ `SELECT_METHOD`); non-destructive,
  leaves Deposit/Exchange reachable. No change.

## Implementation strategy (per file)

1. **`src/types.ts`** — add `consumerOwnsWallets?: boolean` to `RozoPayModalOptions`.
2. **`components/RozoPayButton/types.ts`** — add `consumerOwnsWallets?: boolean`
   to `PayButtonCommonProps` (next to `connectedWalletOnly`).
3. **`hooks/usePaymentState.ts`** — add `consumerOwnsWallets` + `setConsumerOwnsWallets`
   to the `PaymentState` interface, the `useState`, and the returned object.
4. **`provider/RozoPayProvider.tsx`** — after `setConnectedWalletOnly`, call
   `paymentState.setConsumerOwnsWallets(modalOptions.consumerOwnsWallets ?? false)`.
5. **`components/RozoPayButton/index.tsx`** — destructure `consumerOwnsWallets`
   from props, include it in `modalOptions` + the `useCallback` deps.
6. **`components/Common/SelectAnotherMethodButton/index.tsx`** — read
   `consumerOwnsWallets` from `usePayContext()`; `if (consumerOwnsWallets) return null;`.
   (Covers SelectToken, SelectDepositAddressChain, ConnectStellar,
   WaitingDepositAddress, Error.)
7. **`components/Pages/SelectMethod/index.tsx`**
   - destructure `consumerOwnsWallets`;
   - `disconnectAll` (`:67`) also skip Stellar when `consumerOwnsWallets`
     (`&& !consumerOwnsWallets`), add to deps;
   - gate `unconnectedWalletOption` with `!connectedWalletOnly && !consumerOwnsWallets` (`:351`);
   - extend `showStellarOption` (`:424`) to
     `!(isStellarExternalKit || consumerOwnsWallets) && isStellarConnected`;
   - add `consumerOwnsWallets` to `allOptions` deps (`:486`).
8. **`components/Pages/SelectToken/index.tsx`**
   - destructure `consumerOwnsWallets`;
   - `isAnotherMethodButtonVisible` (`:85`) → `!connectedWalletOnly && !consumerOwnsWallets`;
   - redirect effect (`:155`) → `if (connectedWalletOnly || consumerOwnsWallets) return;`,
     add to deps.
9. **`components/Pages/SwitchNetworks/index.tsx`** — import `usePayContext`, read
   `consumerOwnsWallets`, gate the disconnect `Button` (`:49`) with `&& !consumerOwnsWallets`.
10. **`components/Pages/Solana/ConnectorSolana/index.tsx`** — read `consumerOwnsWallets`
    from `paymentState`; in "Try Again" `onClick` (`:121`) skip `disconnect()` when set.

## Verification

- Type-check / lint the package (`pnpm lint` in `packages/connectkit`).
- Example app (`examples/nextjs-app`): mount `<RozoPayButton consumerOwnsWallets />`
  with the consumer's wagmi config connected to EVM+Solana+Stellar.
  - Assert no "Pay with another method" / "Pay with another wallet" anywhere.
  - Assert clicking through never triggers a wagmi `disconnect` in the consumer app.
  - Assert Deposit Address + Exchange still reachable.
  - Assert connected-wallet tiles still pay.
- Confirm `connectedWalletOnly` and `isStellarExternalKit` still behave correctly
  (no regression / double-hiding).

## Open questions (`?`)

- Per-chain granularity (`consumerOwnsWallets: { evm?, solana?, stellar? }`) if a
  future consumer owns only some chains.
- Whether `SwitchNetworks` should be hidden entirely (not just its disconnect
  button) when the consumer owns the wallet, since chain-switching still requires
  consumer cooperation.

## Out of scope

- Isolating the SDK's wagmi instance from the consumer (bigger architectural
  change; would also fix this at the root but is not requested).
- Hiding the connected-wallet tiles (we WANT users to pay with them).
