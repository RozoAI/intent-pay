# Intent Propagation to getFee — Design

Date: 2026-08-03

## Problem

`RozoPayButton`'s `intent` prop already reaches `createPayment` correctly:

`RozoPayButton` → `payParams.intent` → `buildCreatePaymentPayload` (`packages/connectkit/src/payment/createPaymentPayload.ts:251`) → `CreateNewPaymentParams.intent` → `createPayment` request body (`packages/pay-common/src/api/payment.ts:63,133`).

It does **not** reach `getFee`. `GetFeeParams` (`packages/pay-common/src/api/fee.ts:37-46`) has no `intent` field, and none of its callers pass one — even though `getFee` posts to the same backend endpoint (`payment-api/payments?dryrun=true`) that `createPayment` posts to (`/payment-api`).

`createPaymentPayload.ts` also auto-forces `intent: "stellar_direct"` when source and destination are both Stellar with the same token (USDC or EURC) — a zero-fee direct-settlement path — regardless of what the consumer passed. Because `getFee` never sees this, the fee quote shown to the user before payment doesn't reflect the discount they'll actually get (or, for a future intent value that raises cost, could show a quote that's too low). Fee quote and actual settlement can silently diverge.

## Fix

### 1. `packages/pay-common/src/api/fee.ts`
- Add `intent?: string` to `GetFeeParams`.
- Thread it into the POST body: `...(intent ? { intent } : {})`, alongside the existing conditional spreads.

### 2. New shared helper — `packages/pay-common/src/api/intent.ts`
Extract the stellar_direct auto-detect logic currently inlined in `createPaymentPayload.ts:241-251` into one exported function, so `getFee` and `createPayment` always agree on what intent applies to a given payment:

```ts
export function resolveIntent(params: {
  payParamsIntent?: string;
  sourceChainId: number;
  sourceTokenAddress: string;
  destChainId: number;
  destTokenAddress: string;
}): string | undefined
```

Logic (moved verbatim from `createPaymentPayload.ts`):
- `isStellarSameToken` = source and dest chain both `rozoStellar.chainId`, and token addresses match (case-insensitive).
- `isSupportedStellarToken` = dest token is `rozoStellarUSDC` or `rozoStellarEURC`.
- `isStellarDirect` = both true → force `"stellar_direct"`, overriding any consumer-supplied `payParamsIntent`.
- Otherwise → return `payParamsIntent` unchanged (including `undefined`).

Exported from `pay-common`'s public entry point alongside `getFee`/`createPayment`.

### 3. Call-site wiring

**`packages/connectkit/src/payment/createPaymentPayload.ts`**
Replace the inline `isStellarDirect`/`intent` computation (lines 241-251) with a call to `resolveIntent(...)`. No behavior change here — this is the reference implementation being extracted.

**`packages/connectkit/src/utils/feeCache.ts`**
- Add `intent` to the cache key (`JSON.stringify({...})` in `getCachedFee`) so quotes for different intents never collide.

**Fee-quote call sites** — add `intent: resolveIntent(...)` to the params object passed to `getFee` / `getCachedFee`:
- `packages/connectkit/src/components/Pages/WaitingDepositAddress/index.tsx` (`getFee` call, ~line 361)
- `packages/connectkit/src/components/Pages/Solana/PayWithSolanaToken/index.tsx` (`getCachedFee` call, ~line 182)
- `packages/connectkit/src/components/Pages/Stellar/PayWithStellarToken/index.tsx` (`getCachedFee` call, same pattern as Solana)
- `packages/connectkit/src/components/Pages/PayWithToken/index.tsx` (`getCachedFee` call, EVM flow, same pattern)

Each call site passes:
- `payParamsIntent`: `payParams?.intent` (or `paymentState.payParams?.intent`, matching existing local var naming)
- `sourceChainId`/`sourceTokenAddress`: from the selected wallet option / deposit option (whatever that call site already has in scope for `sourceChainId`/`sourceTokenSymbol`)
- `destChainId`/`destTokenAddress`: from `currentOrder.destFinalCallTokenAmount.token` (already in scope at each site)

### 4. Dependency fix (done)
`packages/connectkit/package.json` — `@rozoai/intent-common` changed from pinned `"0.1.26"` to `"workspace:*"`, and `pnpm install` run to re-link. This was already broken (connectkit was resolving `pay-common` from the registry, not the workspace symlink) and blocks any of the above from being testable via `pnpm dev` without a publish. Not part of the intent-propagation feature itself, but a prerequisite for developing it locally.

## Packages affected

- `packages/pay-common` (`@rozoai/intent-common`): `src/api/fee.ts`, new `src/api/intent.ts`, index export.
- `packages/connectkit` (`@rozoai/intent-pay`): `src/payment/createPaymentPayload.ts`, `src/utils/feeCache.ts`, `src/components/Pages/WaitingDepositAddress/index.tsx`, `src/components/Pages/Solana/PayWithSolanaToken/index.tsx`, `src/components/Pages/Stellar/PayWithStellarToken/index.tsx`, `src/components/Pages/PayWithToken/index.tsx`, `package.json` (dependency fix, already applied).

Build order: `pay-common` must build before `connectkit` picks up the new export (existing monorepo convention — `pnpm dev:common` before `pnpm dev:pay`).

## Testing

- `packages/connectkit/test/createPaymentPayload.test.ts` already covers `buildCreatePaymentPayload`'s stellar_direct behavior — extend/reuse assertions against the new `resolveIntent` helper directly (pay-common has no existing test file for `fee.ts`; add one alongside `resolveIntent`).
- Manual: exercise Stellar USDC→USDC (direct), Stellar USDC→EVM (not direct), and an explicit `intent` prop override, confirming the fee quote shown in `WaitingDepositAddress`/`PayWithStellarToken` matches what `createPayment` ultimately charges.

## Out of scope

- No change to `createPayment`'s handling of `intent` — already correct.
- No new intent values or backend contract changes — this only makes the frontend consistent with what the backend already accepts.
