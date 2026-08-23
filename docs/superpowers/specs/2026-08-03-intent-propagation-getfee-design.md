# Intent Propagation to getFee — Design

Date: 2026-08-03 (revised)

## Problem

`RozoPayButton`'s `intent` prop already reaches `createPayment` correctly:

`RozoPayButton` → `payParams.intent` → `buildCreatePaymentPayload` (`packages/connectkit/src/payment/createPaymentPayload.ts:251`) → `CreateNewPaymentParams.intent` → `createPayment` request body (`packages/pay-common/src/api/payment.ts:63,133`).

It does **not** reach `getFee`. `GetFeeParams` (`packages/pay-common/src/api/fee.ts:37-46`) is a separate, narrower shape with no `intent` field, and every caller hand-builds one from scratch instead of reusing the `CreateNewPaymentParams` object already built for `createPayment`/`hydrateOrder`.

`createPaymentPayload.ts` also auto-forces `intent: "stellar_direct"` when source and destination are both Stellar with the same token (USDC or EURC) — a zero-fee direct-settlement path. Because `getFee` never sees this, the fee quote shown to the user before payment doesn't reflect the discount they'll actually get. Fee quote and actual settlement can silently diverge.

## Fix

`getFee` and `createPayment` hit the same backend endpoint with the same payload — `getFee` is just `createPayment` with `?dryrun=true`. Make that literal: `getFee` takes the exact same `CreateNewPaymentParams` input as `createPayment`, builds the same request body, and only differs in the dryrun query param and not throwing on a missing id.

### 1. `packages/pay-common/src/api/payment.ts`
- Extract the `paymentData` construction currently inlined in `createPayment` (lines 99-143: source/destination/display/metadata/webhook/intent assembly, including the `apiVersion === "v1"` branch) into an internal function `buildPaymentRequestBody(params: CreateNewPaymentParams): CreatePaymentRequest`.
- `createPayment` calls it, POSTs to `/payment-api`, keeps its existing `response.data.id` check/throw — unchanged behavior.
- Add `getFee(params: CreateNewPaymentParams): Promise<ApiResponse<FeeResponseData>>` alongside `createPayment`: calls `buildPaymentRequestBody`, POSTs to `payment-api/payments` with `{ params: { dryrun: "true" } }`, parses the response the same way the current `fee.ts#getFee` does (check `result.error`, check `"error" in result.data` for `FeeErrorData`, else return `FeeResponseData`).

### 2. `packages/pay-common/src/api/fee.ts`
- Delete `GetFeeParams` interface — no longer needed.
- Keep `FeeResponseData`/`FeeErrorData` interfaces (still the response shape).
- Remove the old `getFee` implementation; re-export the new one from `payment.ts` (`export { getFee } from "./payment"`) so the public import path (`@rozoai/intent-common`) is unchanged.

### 3. `packages/connectkit/src/utils/feeCache.ts`
- `getCachedFee` param type changes from `GetFeeParams` to `CreateNewPaymentParams`.
- Cache key: switch from the current field-by-field pick to `JSON.stringify(params)` directly (the whole payload now determines the quote, including `intent`), or keep an explicit key listing every `CreateNewPaymentParams` field that affects pricing — including `intent`. Either way, `intent` must be part of the key so different intents don't share stale cache entries.

### 4. Call-site simplification
Each of these currently builds a bespoke `GetFeeParams` object by hand. They already build (or can build via `buildCreatePaymentPayload`) a `CreateNewPaymentParams` object for the actual payment — pass that same object into `getFee`/`getCachedFee` instead of a separate hand-rolled one:

- `packages/connectkit/src/components/Pages/WaitingDepositAddress/index.tsx` (~line 361)
- `packages/connectkit/src/components/Pages/Solana/PayWithSolanaToken/index.tsx` (~line 182)
- `packages/connectkit/src/components/Pages/Stellar/PayWithStellarToken/index.tsx` (same pattern as Solana)
- `packages/connectkit/src/components/Pages/PayWithToken/index.tsx` (EVM flow, same pattern)

Where a call site doesn't already have a full `CreateNewPaymentParams` in scope (e.g. it only has a selected wallet option + order, not a full hydrate payload), construct one via `buildCreatePaymentPayload({ payParams, order: currentOrder, walletOption: option, ... })` — the same helper `hydrateOrder`/`createPayment` call sites already use — rather than hand-mapping fields. This means `intent` (including the stellar_direct auto-detect) is correct automatically, no separate resolution logic needed.

### 5. Dependency fix (done)
`packages/connectkit/package.json` — `@rozoai/intent-common` changed from pinned `"0.1.26"` to `"workspace:*"`, `pnpm install` run to re-link. Prerequisite for developing/testing the above locally via `pnpm dev`.

## Packages affected

- `packages/pay-common` (`@rozoai/intent-common`): `src/api/payment.ts` (extract `buildPaymentRequestBody`, add `getFee`), `src/api/fee.ts` (drop `GetFeeParams`, re-export `getFee`).
- `packages/connectkit` (`@rozoai/intent-pay`): `src/utils/feeCache.ts`, `src/components/Pages/WaitingDepositAddress/index.tsx`, `src/components/Pages/Solana/PayWithSolanaToken/index.tsx`, `src/components/Pages/Stellar/PayWithStellarToken/index.tsx`, `src/components/Pages/PayWithToken/index.tsx`, `package.json` (dependency fix, already applied).

`createPaymentPayload.ts` is unchanged — its `resolveDestinationAddress`/stellar_direct logic stays exactly where it is; call sites now route through it (or an equivalent full payload) before calling `getFee`, instead of `getFee` needing its own copy of that logic.

Build order: `pay-common` builds before `connectkit` picks up the new `getFee` signature (existing monorepo convention — `pnpm dev:common` before `pnpm dev:pay`).

## Testing

- `packages/connectkit/test/createPaymentPayload.test.ts` already covers `buildCreatePaymentPayload`'s stellar_direct behavior — no change needed there, it's now exercised on the `getFee` path too since call sites route through it.
- Add a pay-common test asserting `getFee` and `createPayment` build identical request bodies for the same `CreateNewPaymentParams` input (minus the dryrun query param) — this is the invariant the whole fix rests on.
- Manual: exercise Stellar USDC→USDC (direct), Stellar USDC→EVM (not direct), and an explicit `intent` prop override, confirming the fee quote shown in `WaitingDepositAddress`/`PayWithStellarToken` matches what `createPayment` ultimately charges.

## Out of scope

- No change to `createPayment`'s response handling or the `apiVersion === "v1"` branch behavior — extracted verbatim.
- No new intent values or backend contract changes — this only makes the frontend consistent with what the backend already accepts, and removes a duplicated payload-shaping path.
