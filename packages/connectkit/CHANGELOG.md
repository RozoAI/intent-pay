# Changelog

All notable changes to `@rozoai/intent-pay` (connectkit) are documented in this file.

## [Unreleased]

### Changed

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
