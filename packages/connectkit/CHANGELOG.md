# Changelog

All notable changes to `@rozoai/intent-pay` (connectkit) are documented in this file.

## [Unreleased]

### Fixed

- ERC20 (USDC/USDT) wallet payments on EVM chains now check that the payer
  holds enough native coin (ETH/BNB/POL/HYPE) for the network fee before the
  wallet opens. When it is short, the payment page explains why ("Your wallet
  has no ETH to pay the network fee (about $X needed)...") instead of a bare
  "Retry Payment", and emits `payment_blocked_no_gas` (amounts only, no
  addresses). The check fails open: RPC errors, contract accounts (Safe, smart
  wallets, EIP-7702) and wallets advertising `paymasterService` /
  `auxiliaryFunds` are never blocked, and "Try anyway" bypasses it.
- `payWithToken` accepts an optional third `{ skipGasPrecheck?: boolean }`
  argument (backward compatible).
- The native-gas precheck now runs **before** the wallet chain switch, so a
  payer with no gas coin no longer sees a chain-switch (or transfer) wallet
  prompt at all. Every balance / gas-price / bytecode read passes an explicit
  `chainId`, so it does not need the wallet on the target chain.
- A wallet-side "insufficient funds for gas" rejection is now classified
  (`isInsufficientFundsError`, walking viem's nested `cause` chain) and routed
  to the same "Network Fee Needed" screen with an explanatory message, instead
  of a silent "Payment Cancelled". This covers the gap the lenient precheck
  cannot: wallets apply a larger `maxFeePerGas` buffer than `eth_gasPrice`.
- `PayWithToken` state transitions no longer go through a stale `payState`
  closure guard. That guard could silently drop a transition (e.g. back to
  "Network Fee Needed") when `handleTransfer` held a `setPayState` from an older
  render, leaving the UI stuck on "Waiting for Confirmation".

### Changed

- `PaymentState` exposes `precheckErc20WalletGas(walletOption)`, and
  `payment/erc20GasPrecheck` takes an optional `debug` sink so the SDK's `log`
  can trace why a check passed, was skipped (fail open) or blocked. Also
  exports `isInsufficientFundsError` and `formatWalletNoGasMessage`. All
  additive and backward compatible.

- `hydrateOrder` and `hydrateOrderRozo` on `UseRozoPay` accept an optional third
  `feeType?: FeeType` parameter. The parameter is optional and backward
  compatible with all existing call sites; when omitted, the value falls back
  to `payParams.feeType ?? FeeType.ExactIn`.
- `hydrateOrder` / `hydrateOrderRozo` now accept
  `WalletPaymentOption | HydrateWalletOption` for the `walletPaymentOption`
  argument. `WalletPaymentOption` (previously the only accepted type) is
  structurally assignable to `HydrateWalletOption`, so existing consumers do
  not need changes.

### Added

- `HydrateWalletOption` type exported from `paymentFsm`. Minimal shape needed
  to hydrate an order (`required.token`, `required.amount`, `fees.usd`) for
  callers that don't have a full `WalletPaymentOption` yet — currently used by
  the deposit-address hydration path.
- Optional `sourceAmountUnits` and `sourceTokenSymbol` fields on
  `RozoPayOrderMetadata` (via `zRozoPayOrderMetadata` in `@rozoai/intent-common`).
  Written by `formatPaymentResponseToHydratedOrder` for deposit-address flows
  where the source token can be native (SOL/ETH/XLM) and its amount differs
  from the USD/destination payout.

### Fixed

- Deposit-address flow no longer falls back to `order.usdValue` when
  `metadata.sourceAmountUnits` is missing for native source tokens. Falling
  back to `usdValue` would show the destination USD amount (e.g. `"1"` USDC)
  instead of the correct native amount (e.g. `"0.016885"` SOL). The flow now
  throws with a descriptive error when this invariant is violated.
- `formatPaymentResponseToHydratedOrder` no longer crashes when
  `PaymentResponse.metadata` is `null` (the spread was previously unguarded).
- `WaitingDepositAddress` guards against non-finite native-token prices from
  `getTokenPrices`, and logs a warning when the returned price is marked
  `stale`.
