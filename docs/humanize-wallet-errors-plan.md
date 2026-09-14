# Humanized Wallet Error Helper Plan

## Goal

Create one reusable error helper in `@rozoai/intent-common` that turns raw wallet/SDK/RPC errors into stable payment error metadata for ConnectKit and external consumers.

Caller should be able to pass only the raw error:

```ts
const humanized = humanizeWalletError(error);
```

Optional chain hint is allowed for ambiguous cases, but helper must still auto-detect known EVM, Solana, and Stellar error shapes by itself.

```ts
const humanized = humanizeWalletError(error, { chain: "stellar" });
```

## Non-goals

- Do not return UI copy like `title`, `description`, `headline`, or `action`.
- Do not make ConnectKit callers regex raw errors directly.
- Do not add new dependencies.
- Do not hide raw diagnostics from telemetry/support.

## Public API

Add to `packages/pay-common/src/humanizeWalletError.ts` and export from `packages/pay-common/src/index.ts`.

```ts
export type WalletErrorChain = "evm" | "solana" | "stellar";

export type WalletErrorType =
  | "rejected"
  | "insufficient_funds"
  | "insufficient_fee"
  | "pending_request"
  | "wallet_disconnected"
  | "unsupported"
  | "stale_transaction"
  | "trustline_missing"
  | "invalid_destination"
  | "network"
  | "payment_failed"
  | "unknown";

export type HumanizedWalletError = {
  type: WalletErrorType;
  reason: string;
  retryable: boolean;
  rawMessage: string;
  chain?: WalletErrorChain;
};

export function humanizeWalletError(
  error: unknown,
  options?: { chain?: WalletErrorChain },
): HumanizedWalletError;
```

## `reason` rules

`reason` must be:

- human-readable
- short enough for modal body text
- chain-aware when certainty is high
- not overloaded with recovery instruction
- stable enough for consumers to display directly

Examples:

```ts
{
  type: "rejected",
  reason: "Wallet confirmation was rejected.",
  retryable: true,
  rawMessage: "User rejected the request.",
  chain: "evm",
}
```

```ts
{
  type: "insufficient_funds",
  reason: "Wallet balance cannot cover payment amount plus network fees.",
  retryable: false,
  rawMessage: "insufficient funds for gas * price + value",
  chain: "evm",
}
```

```ts
{
  type: "stale_transaction",
  reason: "Transaction was built from stale account state.",
  retryable: true,
  rawMessage: "tx_bad_seq",
  chain: "stellar",
}
```

## Detection order

Run strongest structured checks first. Use generic message matching only as fallback.

```ts
export function humanizeWalletError(error, options) {
  return (
    detectStellarError(error, options) ??
    detectSolanaError(error, options) ??
    detectEvmError(error, options) ??
    detectGenericWalletError(error) ??
    unknownWalletError(error, options)
  );
}
```

If `options.chain` exists, prefer that chain detector first, then try other chain detectors, then generic fallback.

## Shared extraction helpers

Implement tiny internal helpers:

- `getErrorName(error)`
- `getErrorCode(error)`
- `getRawMessage(error)`
- `getNestedMessages(error)`
- `getStellarResultCodes(error)`
- `getSolanaTransactionError(error)`

`getNestedMessages` should inspect common wrappers without throwing:

- `error.message`
- `error.shortMessage`
- `error.details`
- `error.cause`
- `error.error`
- `error.data.message`
- `error.response.data.detail`
- `error.response.data.extras.result_codes`

## EVM mapping

Official basis:

- EIP-1193 provider errors
- Viem error glossary
- Wagmi `useSendTransaction` uses async mutation errors from underlying Viem/provider
- MetaMask docs/search snippets for common provider codes

Mappings:

| Signal | Type | Retryable | Reason |
| --- | --- | --- | --- |
| `code === 4001` | `rejected` | `true` | `Wallet confirmation was rejected.` |
| `name === "UserRejectedRequestError"` | `rejected` | `true` | `Wallet confirmation was rejected.` |
| message has `user rejected`, `rejected the request`, `denied` | `rejected` | `true` | `Wallet confirmation was rejected.` |
| `code === -32002` | `pending_request` | `true` | `Wallet already has a pending request.` |
| `name === "InsufficientFundsError"` | `insufficient_funds` | `false` | `Wallet balance cannot cover payment amount plus network fees.` |
| message has `insufficient funds`, `insufficient balance`, `gas required exceeds allowance` | `insufficient_funds` | `false` | `Wallet balance cannot cover payment amount plus network fees.` |
| `code === 4900` or `code === 4901` | `wallet_disconnected` | `true` | `Wallet is disconnected from requested network.` |
| `code === 4100` | `unsupported` | `true` | `Wallet has not authorized this account or method.` |
| `code === 4200` | `unsupported` | `false` | `Wallet does not support this method.` |
| message has `chain not configured`, `unsupported chain`, `switch chain` | `unsupported` | `true` | `Wallet cannot use requested network yet.` |
| message has `network`, `connection`, `timeout`, `rpc` | `network` | `true` | `Network request failed before transaction completed.` |

## Solana mapping

Official basis:

- `@solana/web3.js` `SendTransactionError`
- `@solana/wallet-adapter-base` error classes
- Solana wallet-adapter FAQ/search snippets

Mappings:

| Signal | Type | Retryable | Reason |
| --- | --- | --- | --- |
| `WalletSignTransactionError` with rejected/declined message | `rejected` | `true` | `Wallet confirmation was rejected.` |
| `WalletSendTransactionError` with rejected/declined message | `rejected` | `true` | `Wallet confirmation was rejected.` |
| message has `user rejected`, `declined`, `denied` | `rejected` | `true` | `Wallet confirmation was rejected.` |
| `WalletNotConnectedError`, `WalletDisconnectedError` | `wallet_disconnected` | `true` | `Wallet is disconnected.` |
| `WalletNotReadyError`, `WalletLoadError` | `unsupported` | `true` | `Wallet is not ready for this request.` |
| `SendTransactionError.transactionError.message` has `insufficient funds`, `insufficient lamports`, `rent` | `insufficient_funds` | `false` | `SOL balance cannot cover amount, fees, or rent.` |
| nested logs have `insufficient funds`, `insufficient lamports`, `rent` | `insufficient_funds` | `false` | `SOL balance cannot cover amount, fees, or rent.` |
| message has `blockhash not found`, `block height exceeded`, `expired` | `stale_transaction` | `true` | `Transaction expired before it was confirmed.` |
| message has `timeout`, `failed to get recent blockhash`, `network` | `network` | `true` | `Solana network request failed before transaction completed.` |

## Stellar mapping

Official basis:

- Stellar Horizon error handling docs
- Stellar transaction result codes docs
- js-stellar-sdk error handling search result
- Freighter API integration search snippet

Mappings:

| Signal | Type | Retryable | Reason |
| --- | --- | --- | --- |
| Freighter-like `code === -4` with declined/rejected context | `rejected` | `true` | `Wallet confirmation was rejected.` |
| message has `rejected`, `declined`, `denied` | `rejected` | `true` | `Wallet confirmation was rejected.` |
| Horizon `transaction === "tx_insufficient_balance"` | `insufficient_funds` | `false` | `XLM balance cannot cover transaction fee and minimum reserve.` |
| Horizon `transaction === "tx_insufficient_fee"` | `insufficient_fee` | `true` | `Transaction fee is too low for Stellar network conditions.` |
| Horizon `transaction === "tx_bad_seq"` | `stale_transaction` | `true` | `Transaction was built from stale account state.` |
| Horizon `transaction === "tx_bad_auth"` | `unsupported` | `false` | `Transaction has missing signatures or wrong network.` |
| Horizon operation includes `op_underfunded` | `insufficient_funds` | `false` | `Wallet balance cannot cover this Stellar operation.` |
| Horizon operation includes `op_no_trust` | `trustline_missing` | `false` | `Destination account is missing required asset trustline.` |
| Horizon operation includes `op_no_destination` | `invalid_destination` | `false` | `Destination Stellar account does not exist.` |
| Horizon operation includes `op_low_reserve` | `insufficient_funds` | `false` | `XLM balance would fall below Stellar minimum reserve.` |
| async status `TRY_AGAIN_LATER` | `network` | `true` | `Stellar network asked client to try again later.` |
| async status `DUPLICATE` | `payment_failed` | `false` | `Transaction was already submitted.` |

## Generic fallback mapping

Use only when chain-specific detector did not match.

| Signal | Type | Retryable | Reason |
| --- | --- | --- | --- |
| rejected/declined/denied/cancelled | `rejected` | `true` | `Wallet confirmation was rejected.` |
| insufficient funds/balance/gas/fee/lamports/rent | `insufficient_funds` | `false` | `Wallet balance cannot cover payment amount plus network fees.` |
| already pending/request pending | `pending_request` | `true` | `Wallet already has a pending request.` |
| disconnected/not connected | `wallet_disconnected` | `true` | `Wallet is disconnected.` |
| unsupported/not supported/wrong network | `unsupported` | `true` | `Wallet cannot complete this request.` |
| timeout/network/rpc/fetch | `network` | `true` | `Network request failed before transaction completed.` |

## ConnectKit integration plan

1. Import `humanizeWalletError` from `@rozoai/intent-common`.
2. Replace direct checks like `errorMessage.includes("rejected")`.
3. Use `retryable` to decide modal vs Error page.
4. Pass `HumanizedWalletError` through `routeMeta.error` when routing to `ROUTES.ERROR`.
5. Error page should accept either:
   - current string error
   - `HumanizedWalletError`
6. Error page displays `reason`; consumer/app decides surrounding label/button copy.
7. Analytics records:
   - `type`
   - `reason`
   - `rawMessage`
   - `chain`
   - `retryable`

## Intended ConnectKit behavior

| Type | ConnectKit behavior |
| --- | --- |
| `rejected` | Stay in payment page, show existing Retry Payment affordance. |
| `pending_request` | Stay in payment page, retryable once wallet prompt clears. |
| `wallet_disconnected` | Route to Error or connector flow depending page context. |
| `stale_transaction` | Clear stale transaction data if needed, stay retryable. |
| `network` | Retryable Error page or stay in modal if transaction not submitted. |
| `insufficient_funds` | Error page or inline failure, not auto-retry. |
| `insufficient_fee` | Retryable after rebuilding fee/transaction. |
| `trustline_missing` | Error page, not retryable until user/destination fixes trustline. |
| `invalid_destination` | Error page, not retryable with same destination. |
| `unsupported` | Retryable only when network/wallet switch can fix it. |
| `unknown` | Error page with support fallback. |

## Tests

Add `packages/pay-common/test/humanizeWalletError.test.ts`.

Minimum cases:

1. EVM `code: 4001` → `rejected`, `retryable: true`, `chain: "evm"`
2. EVM `name: "InsufficientFundsError"` → `insufficient_funds`, `retryable: false`
3. EVM `code: -32002` → `pending_request`, `retryable: true`
4. Solana `name: "WalletSignTransactionError"`, rejected message → `rejected`
5. Solana `SendTransactionError`-like `transactionError.message` with insufficient lamports → `insufficient_funds`
6. Solana blockhash expired message → `stale_transaction`, `retryable: true`
7. Stellar Horizon `tx_insufficient_balance` → `insufficient_funds`
8. Stellar Horizon `tx_insufficient_fee` → `insufficient_fee`, `retryable: true`
9. Stellar Horizon `tx_bad_seq` → `stale_transaction`, `retryable: true`
10. Stellar operation `op_no_trust` → `trustline_missing`, `retryable: false`
11. Freighter-like declined error → `rejected`
12. Unknown `new Error("wat")` → `unknown`, `retryable: false`, raw preserved

## Verification

Run:

```bash
cd packages/pay-common && pnpm test
pnpm build
```

Then run ConnectKit build after integration:

```bash
cd packages/connectkit && pnpm build
```

## Open question before implementation

`retryable` means “safe for SDK to offer another attempt,” not “same transaction should be re-submitted.” For `stale_transaction`, retry must rebuild transaction/XDR/blockhash first.
