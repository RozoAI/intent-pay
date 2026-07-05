# WaitingDepositAddress payin poll fallback — Design

**Date:** 2026-07-05
**Status:** Approved, pending implementation
**Package:** `packages/connectkit` (`@rozoai/intent-pay`)

## Problem

`WaitingDepositAddress` (deposit-address QR flow) detects the user's payin via
**Pusher only** (`usePusherPayout` → `onPayinDetected`). If the Pusher WebSocket
drops during the window when the backend fires the `status-update` event, that
event is lost — Pusher does not replay missed messages. The user sits on the QR
screen indefinitely and must refresh manually.

`Confirmation` already solved the equivalent problem for the **payout** step: a
60s timer flips from Pusher to polling (`usePayoutPolling`) if the payout hasn't
resolved. Deposit **payin** detection has no such fallback.

## Scope

**One screen: `WaitingDepositAddress`.**

`Confirmation`'s payout fallback already runs at 60s and is **not** changed by
this work. (Decision: "60s for both" — Confirmation is already 60s, so no edit
there.)

Not in scope: any change to the FSM, `paymentEffects.ts` (its pollers remain
commented out — irrelevant here), or `Confirmation`.

## Decisions (locked)

| Decision | Choice |
|---|---|
| Fallback timeout | **60s** (matches Confirmation) |
| On fallback fire | **Unsubscribe Pusher**, poll takes over solo (matches Confirmation) |
| Payin "detected" signal | **`source.txHash` present** (parity with Pusher `source_txhash` path) |
| Timer lifecycle | **Reset per deposit `externalId`** (QR refresh / option switch restarts timer) |

## Components

### New hook: `packages/connectkit/src/hooks/usePayinPolling.ts`

Mirrors `usePayoutPolling.ts` (~45 lines).

- **Inputs:** `{ enabled: boolean | undefined; rozoPaymentId: string | undefined; log: PayLogFn }`
- **Behavior:** when `enabled` and `rozoPaymentId` set, poll `getPayment(rozoPaymentId, "v2")` every `POLL_DELAY = 1000`ms.
- **Detection:** payin found when `response.data.source.txHash` is a non-empty string. On detection, set result and stop polling.
- **Returns:** `{ payinTxHash: string | undefined }`.
- **Lifecycle:** `isActive` flag + `clearTimeout` on cleanup; `catch` logs and reschedules (never dies mid-payment). Copied from `usePayoutPolling` lines 89-144.

Field reference: `getPayment` v2 response exposes `data.source.txHash` (payin)
and `data.destination.txHash` (payout, used by `usePayoutPolling`). This hook
reads the **source** field.

### Changes to `packages/connectkit/src/components/Pages/WaitingDepositAddress/index.tsx`

The active deposit payment id is the existing `depAddr.externalId` (also stored
via `setRozoPaymentId`). Use `rozoPaymentId || depAddr?.externalId` as the
active id — same expression the current Pusher block uses (line 121).

1. **New state / refs** (shape cloned from Confirmation lines 68-77):
   - `pusherEnabled` (default `true`), `pollingEnabled` (default `false`)
   - `timeoutIdRef`, `pusherEnabledRef`, `pusherUnsubscribeRef`, `payinDetectedRef`, `prevPaymentIdRef`

2. **Gate existing Pusher** — extend the current `pusherEnabled` computation
   (lines 112-117) to also require the new `pusherEnabled` state flag:
   `enabled: pusherEnabled && <existing conditions>`. Capture `unsubscribe`
   from `usePusherPayout` into `pusherUnsubscribeRef`.

3. **60s timer effect**, keyed on the active `externalId` (clone of Confirmation
   lines 358-435): set once per id; on fire, if payin not yet detected
   (`!payinDetectedRef.current`) and Pusher still enabled → unsubscribe Pusher,
   `setPusherEnabled(false)`, `setPollingEnabled(true)`.

4. **Reset effect** on `prevPaymentIdRef` vs current active id (clone of
   Confirmation lines 438-462): when the id changes (QR refresh / deposit option
   switch → new `externalId`), clear the timer, re-enable Pusher, disable
   polling, reset `payinDetectedRef`, restart the 60s window.

5. **Wire `usePayinPolling`:** `enabled: pollingEnabled && !!activeId`,
   `rozoPaymentId: activeId`.

6. **New effect** watching `usePayinPolling`'s `payinTxHash`: when present, call
   the shared `handlePayinDetected(txHash, paymentId)`.

### Shared completion path — `handlePayinDetected`

Both the Pusher `onPayinDetected` callback and the poll result effect converge
on the **same 6 steps** the current Pusher callback runs (lines 122-148):

1. `setPaymentCompleted(txHash, paymentId, null)`
2. `setPaymentPayoutCompleted(txHash, paymentId)`
3. compute `tokenMode` from `selectedDepositAddressOption.id`
   (SOLANA→`"solana"`, STELLAR→`"stellar"`, else `"evm"`)
4. `setTokenMode(tokenMode)`
5. `setTxHash(txHash)`
6. `context.setRoute(ROUTES.CONFIRMATION)`

Extract these into one local `handlePayinDetected(txHash, paymentId)`, guarded
by `payinDetectedRef` (like Confirmation's `paymentCompletedSent`) so it runs
**once**. Both paths call it.

Because we unsubscribe Pusher *before* enabling polling, the two paths cannot
both fire in normal flow. The `payinDetectedRef` guard is belt-and-suspenders
against an in-flight Pusher event landing during the flip — it prevents a
double route.

## Data flow

```
QR shown (externalId set)
  ├─ Pusher subscribed (pusherEnabled=true)
  ├─ 60s timer armed (keyed to externalId)
  │
  ├─ Pusher fires onPayinDetected ──► handlePayinDetected() ──► CONFIRMATION
  │                                    (guard set, timer cleared)
  │
  └─ 60s elapse, no payin:
        unsubscribe Pusher, pusherEnabled=false, pollingEnabled=true
        └─ usePayinPolling polls getPayment every 1s
              └─ source.txHash present ──► handlePayinDetected() ──► CONFIRMATION

QR refresh / switch option (new externalId):
  clear timer, pusherEnabled=true, pollingEnabled=false, guard reset, re-arm 60s
```

## Error handling

- Poll `catch` → `log` + reschedule next poll. Never terminates mid-payment.
  (Matches `usePayoutPolling` lines 127-132.)
- Missing/malformed `getPayment` response → treated as "not yet detected",
  keep polling.

## Testing

Manual, via the Next.js example app (no unit-test harness exists for these
components in the repo).

1. **Happy path:** Pusher still routes instantly on payin — no regression.
2. **Pusher failure:** block the Pusher WS (devtools / offline the WS host),
   send the deposit → poll routes to CONFIRMATION within ~61s.
3. **QR refresh mid-wait:** refresh QR (or switch deposit option) at ~55s →
   verify timer resets to the new address, does not immediately flip to poll on
   the stale id.

## Key insight

Everything except `handlePayinDetected` is a mechanical clone of the proven
`Confirmation` fallback. Extracting the 6-step side-effect sequence into one
guarded function is the single non-mechanical piece and the main correctness
win: it collapses two copies of the completion sequence into one, removing the
double-route drift risk that two hand-maintained copies would carry.
