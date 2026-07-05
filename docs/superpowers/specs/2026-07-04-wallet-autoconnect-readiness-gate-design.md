# Wallet Auto-Connect Readiness Gate — Design

**Date:** 2026-07-04
**Status:** Approved, pending implementation
**Area:** `packages/connectkit` — modal auto-navigation on wallet auto-connect

## Problem

When the SDK modal opens inside a wallet's in-app browser (Phantom, Base App,
MetaMask mobile) with a wallet already connected, landing on the token screen is
flaky. Users must "refresh a few times." Symptom: a flash of `SELECT_METHOD`, or
getting stuck there, instead of auto-navigating to `SELECT_TOKEN`.

### Root cause

The `SELECT_METHOD` auto-navigate effect in `RozoPayModal/index.tsx` races three
independent async signals with no ordering guarantee:

1. Wallet reconnect — wagmi `reconnecting`/`connecting`, Solana adapter `connecting`.
2. Preview order — async `createPreviewOrder()` → FSM leaves `idle` for `preview`.
3. (Downstream, not a gate) token/balance fetch.

The EVM branch gates only on `isEthConnected`, so it is stable. The Solana and
Stellar branches additionally gate on `showSolanaPaymentMethod` /
`showStellarPaymentMethod`, which require `pay.order != null`. When wallet
reconnect wins the race against the order API, those flags are `false`, no branch
matches, and the user is stranded on `SELECT_METHOD`. This is the "residual gap"
already documented in the project's CLAUDE.md insight #11.

Secondary defect: gating on `pay.order != null` cannot distinguish a resolved
order (`preview`) from a failed one (`error`) — an errored preview order can pass
`!= null` and drop the user into a broken token screen.

## Goal

When a wallet is already connected on modal open: show a clean loading state
until data is safe, then land on a stable `SELECT_TOKEN`. No `SELECT_METHOD`
flash, no stuck state, no navigation onto an errored order. Balances continue to
load progressively inside `SELECT_TOKEN` (they are the slow path — insight #7 —
and must not block the gate).

## Approach

A **narrow readiness gate** on the existing `SELECT_METHOD` auto-navigate effect.
It engages **only when a wallet is connected** (the auto-connect path). The
no-wallet path is unchanged: `SELECT_METHOD` renders its tiles immediately as
today.

Gate = block on two cheap, critical signals; let the expensive one (balances)
stream. Chosen over a full-modal gate (would tax every open with the order API)
and over per-race hardening (whack-a-mole, does not match the "prepare data
first" intent).

## The two gate signals

### Signal 1 — wallet settled

Reconnect / autoConnect has finished racing (a wallet is connected, or
definitively none is). Uses values already in the modal:

```ts
const walletSettling =
  ethStatus === "reconnecting" ||
  ethStatus === "connecting" ||
  isSolanaConnecting;
```

"Settled + verified usable" (correct chain, live connector) was considered and
rejected for the gate: at modal open the target chain is unknown (no token
picked yet), so chain-correctness is not answerable here. Wrong-chain / broken
connection stays a per-payment concern at token-select time.

### Signal 2 — order ready (from FSM state)

`useRozoPay()` exposes `paymentState` as the FSM **type string**
(`paymentFsmState.type`, e.g. `"idle"`, `"preview"`, `"error"`, `"payment_*"`)
and `order` typed by that state. Order readiness is read from the FSM, not from
`pay.order != null`:

```ts
const orderPending = paymentState === "idle";
const orderError   = paymentState === "error";
const orderReady   =
  paymentState === "preview" || paymentState.startsWith("payment_");
```

This is strictly safer than `!= null`: it separates `preview` (ready) from
`error` (failed) and from `idle` (still loading).

## Gate logic

Evaluated inside the existing `SELECT_METHOD` auto-navigate effect. "Wallet
connected" = `isEthConnected || isSolanaConnected || isStellarConnected`.

| Condition | Action |
|---|---|
| No wallet connected | Do nothing — `SELECT_METHOD` shows tiles (unchanged) |
| Wallet connected + `walletSettling` | Wait — render modal loading, no navigate |
| Wallet connected, settled, `orderPending` | Wait — render modal loading, no navigate |
| Wallet connected, settled, `orderError` | Route to `ROUTES.ERROR` with FSM `message` |
| Wallet connected, settled, `orderReady` | Navigate to `SELECT_TOKEN` (evm/solana/stellar) |

### Which token screen (eligibility)

Unchanged mapping: `isEthConnected` → evm, `isSolanaConnected` → solana,
`isStellarConnected` → stellar. Order-independent eligibility still applies so we
never navigate to a chain that is not a valid payment method:

- Solana: allowed when `paymentOptions == null` or includes `Solana`.
- Stellar: same, plus the existing `preferredTokens`-has-no-Stellar-token rule.

These are the `solanaPaymentEligible` / `stellarPaymentEligible` memos added to
`usePaymentState.ts` (kept — they are the right primitive). The distinction from
the tiles' `showSolanaPaymentMethod` / `showStellarPaymentMethod`: the `show*`
flags keep the `pay.order` gate because **tapping a tile starts a payment** and
needs an order; **auto-navigating to the token screen does not** — order
readiness is now Signal 2's job.

### Loading visual

Reuse the modal's existing spinner (`components/Spinners` / `Common/Spinner`,
rendered via the standard `PageContent` pattern used by `SelectToken` /
`WaitingWallet`). No new loading component. While the gate is waiting, the modal
shows this loading state in place of `SELECT_METHOD` tiles — the tiles must not
flash.

### Error handling

`orderError` → `ROUTES.ERROR` with `state.message`, reusing the existing Error
page + `routeMeta.error` path. This is new safety: today an errored preview order
cannot reach a clean error screen from this path; it either spins or shows a
broken token screen.

## Files touched

1. `packages/connectkit/src/components/RozoPayModal/index.tsx`
   — rework the single `SELECT_METHOD` auto-navigate effect into the gate above:
   add `walletSettling` / `orderPending` / `orderError` / `orderReady` derived
   from `ethStatus`, `isSolanaConnecting`, and `paymentState`; render the reused
   loading component while waiting; route to ERROR on `orderError`; keep the
   evm/solana/stellar navigation using `solanaPaymentEligible` /
   `stellarPaymentEligible`.
2. `packages/connectkit/src/hooks/usePaymentState.ts`
   — **keep** `solanaPaymentEligible` / `stellarPaymentEligible` (order-independent
   eligibility) and their type/export. No further change.
3. No FSM, tile, provider-internal, or balance-loading changes.

## Non-goals

- No change to the no-wallet path (`SELECT_METHOD` renders immediately).
- No change to balance/fee loading (stays progressive in `SELECT_TOKEN`).
- No change to FSM transitions, tiles, or the three chain providers' internals.
- No "settled + verified chain" gate (deferred to per-payment concern).

## Testing

No unit harness exists for this render-timing race (crosses wagmi, the Solana
adapter, and the order API). Verification is manual, in the real repro:

1. Phantom / Base App / MetaMask in-app browser, wallet connected. Open the modal
   repeatedly — must land on `SELECT_TOKEN` every time. Loading spinner while
   waiting; **never** a `SELECT_METHOD` flash; never stuck.
2. Force a failed `createPreviewOrder()` — must route to the Error page with a
   message, not spin forever and not show a broken token screen.
3. No-wallet open (desktop, no in-app browser) — `SELECT_METHOD` still appears
   immediately with tiles. No regression.
4. Two wallets connected (Phantom EVM + Solana) — still stays on `SELECT_METHOD`
   for explicit wallet choice (Race B behavior preserved).
