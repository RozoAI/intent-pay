# WaitingDepositAddress Payin Poll Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 60s poll fallback to `WaitingDepositAddress` so a dropped Pusher connection no longer strands the user on the QR screen when their deposit payin lands.

**Architecture:** Mirror the proven `Confirmation` payout fallback. A 60s timer keyed to the active deposit `externalId` flips detection from Pusher to a new `usePayinPolling` hook (unsubscribing Pusher first). Both the Pusher callback and the poll result funnel through one guarded `handlePayinDetected` function so the completion side-effects run exactly once and can never double-route.

**Tech Stack:** React 18, TypeScript, `getPayment` (v2 REST via `@rozoai/intent-common`), `pusher-js`. Build via Rollup; lint via oxlint.

## Global Constraints

- Package: `packages/connectkit` (`@rozoai/intent-pay`). All paths below are relative to repo root.
- **No unit-test harness exists in connectkit** — only `pnpm lint` (oxlint) and `pnpm build` (rollup). Verification is: lint clean, build clean, then manual smoke via the Next.js example app. Do NOT invent jest/vitest steps.
- **Do not commit spec/design docs.** Only code changes get commits. (`docs/superpowers/**` stays untracked.)
- **Do not push.** Commit locally only. Branch is `fix/wallet-autoconnect-gate` — do not create/switch branches unless asked.
- Fallback timeout: **60000 ms**. Poll interval: **1000 ms** (`POLL_DELAY`, matching `usePayoutPolling`).
- Payin detected iff `getPayment().data.source.txHash` is a non-empty string.
- Match existing file style: `useRef`/`useState` hooks, `context.log(...)` for logging, 2-space indent, no default exports for hooks (named export `const useX = ...`).

---

## File Structure

- **Create** `packages/connectkit/src/hooks/usePayinPolling.ts` — polls `getPayment` for the payin (`source.txHash`), returns `{ payinTxHash }`. Sole responsibility: source-txhash polling. Mirrors `usePayoutPolling.ts`.
- **Modify** `packages/connectkit/src/components/Pages/WaitingDepositAddress/index.tsx` — add pusher/poll toggle state, 60s timer, per-`externalId` reset, wire the new hook, extract `handlePayinDetected`.

No FSM, `paymentEffects.ts`, or `Confirmation` changes.

---

## Task 1: `usePayinPolling` hook

**Files:**
- Create: `packages/connectkit/src/hooks/usePayinPolling.ts`

**Interfaces:**
- Consumes: `getPayment(id: string, apiVersion: "v2")` from `@rozoai/intent-common` — returns `{ data?: { source: { txHash?: string } } }`. `PayLogFn` from `../provider/PayContext`.
- Produces: `usePayinPolling(options: UsePayinPollingOptions): { payinTxHash: string | undefined }` where `UsePayinPollingOptions = { enabled: boolean | undefined; rozoPaymentId: string | undefined; log: PayLogFn }`.

- [ ] **Step 1: Create the hook file**

Model on `packages/connectkit/src/hooks/usePayoutPolling.ts` but read `source.txHash` instead of `destination.txHash`, and drop the `order`/`done`/`showProcessingPayout`/`triggerResize` inputs (not needed for payin).

```typescript
import { getPayment } from "@rozoai/intent-common";
import { useEffect, useState } from "react";
import { PayLogFn } from "../provider/PayContext";

const POLL_DELAY = 1000;

export interface UsePayinPollingOptions {
  /** Whether polling is enabled (true only after the Pusher fallback fires) */
  enabled: boolean | undefined;
  /** The Rozo payment ID (deposit externalId) to poll for */
  rozoPaymentId: string | undefined;
  /** Logging function */
  log: PayLogFn;
}

export interface UsePayinPollingResult {
  /** The payin (source) transaction hash, once detected */
  payinTxHash: string | undefined;
}

/**
 * Polls getPayment until the source (payin) transaction hash appears.
 * Used as a fallback in WaitingDepositAddress when Pusher misses the payin
 * event. Detection parity with the Pusher path: fires on source.txHash.
 */
export const usePayinPolling = (
  options: UsePayinPollingOptions,
): UsePayinPollingResult => {
  const { enabled, rozoPaymentId, log } = options;

  const [payinTxHash, setPayinTxHash] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !rozoPaymentId) {
      return;
    }

    log("[WAITING_DEPOSIT] Starting payin polling for:", rozoPaymentId);

    let isActive = true;
    let timeoutId: NodeJS.Timeout;

    const pollPayin = async () => {
      if (!isActive || !rozoPaymentId) return;

      try {
        const response = await getPayment(rozoPaymentId, "v2");
        const sourceTxHash = response?.data?.source?.txHash;

        if (
          isActive &&
          typeof sourceTxHash === "string" &&
          sourceTxHash.length > 0
        ) {
          log("[WAITING_DEPOSIT] Found payin transaction:", sourceTxHash);
          setPayinTxHash(sourceTxHash);
          return; // stop polling
        }

        if (isActive) {
          timeoutId = setTimeout(pollPayin, POLL_DELAY);
        }
      } catch (error) {
        console.error("[WAITING_DEPOSIT] Payin polling error:", error);
        if (isActive) {
          timeoutId = setTimeout(pollPayin, POLL_DELAY);
        }
      }
    };

    timeoutId = setTimeout(pollPayin, 0);

    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, rozoPaymentId]);

  return { payinTxHash };
};
```

- [ ] **Step 2: Verify the `source.txHash` shape**

Confirm the v2 response field before trusting it. Check `usePayoutPolling.ts` uses `response.data.destination.txHash` / `response.data.destination.chainId` (lines 100-109) — the `source` object is the sibling. Grep the type to be sure:

Run: `cd packages/connectkit && grep -rn "source" node_modules/@rozoai/intent-common/dist/*.d.ts | grep -i txhash | head`
Expected: a field like `source: { txHash?: string; ... }`. If the field name differs (e.g. `txHash` vs `transactionHash`), update Step 1 to match and note it.

- [ ] **Step 3: Lint the new file**

Run: `cd packages/connectkit && pnpm lint`
Expected: no errors referencing `usePayinPolling.ts`.

- [ ] **Step 4: Commit**

```bash
git add packages/connectkit/src/hooks/usePayinPolling.ts
git commit -m "feat(connectkit): add usePayinPolling fallback hook"
```

---

## Task 2: Wire fallback into WaitingDepositAddress

**Files:**
- Modify: `packages/connectkit/src/components/Pages/WaitingDepositAddress/index.tsx`

**Interfaces:**
- Consumes: `usePayinPolling` from Task 1 (`{ payinTxHash }`).
- Produces: no new exports — internal behavior change only.

Reference points in the current file:
- Pusher enable calc: lines 112-117 (`pusherEnabled` local const — will be **renamed** to avoid clash with new state).
- `usePusherPayout({...})` call: lines 119-154, `onPayinDetected` body is the 6-step sequence to extract.
- Active id expression already in use: `rozoPaymentId || depAddr?.externalId` (line 121).
- `setRozoPaymentId(details.externalId)` on success: line 353.

- [ ] **Step 1: Add fallback state and refs**

Just below the existing `useState` block (after line 109, `feeError` state), add:

```typescript
  // Payin detection: start on Pusher, fall back to polling after 60s.
  const [pusherFallbackEnabled, setPusherFallbackEnabled] = useState(true);
  const [payinPollingEnabled, setPayinPollingEnabled] = useState(false);
  const payinTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const pusherFallbackEnabledRef = useRef(true);
  const pusherUnsubscribeRef = useRef<(() => void) | null>(null);
  const payinDetectedRef = useRef(false);
  const prevActivePaymentIdRef = useRef<string | undefined>(undefined);

  // The active deposit payment id (same expression the Pusher block uses).
  const activePaymentId = rozoPaymentId || depAddr?.externalId;
```

- [ ] **Step 2: Extract the shared `handlePayinDetected`**

Add this function above the `usePusherPayout` call (before line 119). It is the current `onPayinDetected` body (lines 122-148) made reusable and guarded:

```typescript
  const handlePayinDetected = (txHash: string, paymentId?: string) => {
    if (payinDetectedRef.current) return; // run once
    if (!selectedDepositAddressOption) return;
    payinDetectedRef.current = true;

    context.log("[PAYIN DETECTED] Payment received:", txHash);

    setPaymentCompleted(txHash, paymentId, null);
    setPaymentPayoutCompleted(txHash, paymentId);

    const tokenMode =
      selectedDepositAddressOption.id === DepositAddressPaymentOptions.SOLANA
        ? "solana"
        : selectedDepositAddressOption.id ===
            DepositAddressPaymentOptions.STELLAR
          ? "stellar"
          : "evm";
    setTokenMode(tokenMode);
    setTxHash(txHash);

    // Clear the fallback timer — detection done.
    if (payinTimeoutIdRef.current) {
      clearTimeout(payinTimeoutIdRef.current);
      payinTimeoutIdRef.current = null;
    }

    context.setRoute(ROUTES.CONFIRMATION);
  };
```

Note `setPaymentCompleted(txHash, paymentId, null)` matches the current call
signature at line 128 (`payload.source_txhash, rozoPaymentId || payload.payment_id, null`).

- [ ] **Step 3: Rename the existing Pusher-enable const and gate it on the fallback flag**

The current local `const pusherEnabled = !!( ... )` (lines 112-117) name-clashes conceptually with the new flag. Rename it to `pusherConditionsMet` and AND-in the fallback state. Replace lines 112-117:

```typescript
  // Use Pusher to detect payin in real-time (until the 60s fallback flips to poll)
  const pusherConditionsMet = !!(
    depAddr?.externalId &&
    (rozoPaymentId || depAddr?.externalId) &&
    rozoPaymentState !== "payment_started" &&
    rozoPaymentState !== "payment_completed"
  );
```

- [ ] **Step 4: Update the `usePusherPayout` call to use the flag + shared handler + capture unsubscribe**

Replace the `usePusherPayout({...})` call (lines 119-154) with:

```typescript
  const { unsubscribe: pusherUnsubscribe } = usePusherPayout({
    enabled: pusherConditionsMet && pusherFallbackEnabled,
    rozoPaymentId: activePaymentId,
    onPayinDetected: (payload) => {
      if (payload.source_txhash) {
        handlePayinDetected(
          payload.source_txhash,
          rozoPaymentId || payload.payment_id,
        );
      }
    },
    onDataReceived: () => {
      context.log("[PUSHER] Data received for deposit address payment");
    },
    log: context.log,
  });
```

- [ ] **Step 5: Store the unsubscribe fn in its ref**

Immediately after the `usePusherPayout` call, add:

```typescript
  useEffect(() => {
    pusherUnsubscribeRef.current = pusherUnsubscribe;
  }, [pusherUnsubscribe]);
```

- [ ] **Step 6: Add the 60s fallback timer effect**

Add after the unsubscribe-ref effect. Keyed on `activePaymentId`:

```typescript
  // 60s after an address is shown, if Pusher hasn't detected the payin,
  // unsubscribe Pusher and switch to polling. Mirrors Confirmation's payout fallback.
  useEffect(() => {
    if (!activePaymentId || !pusherFallbackEnabled) return;
    if (payinTimeoutIdRef.current !== null) return; // one timer per id

    context.log("[WAITING_DEPOSIT] Arming 60s payin fallback timer");
    payinTimeoutIdRef.current = setTimeout(() => {
      if (pusherFallbackEnabledRef.current && !payinDetectedRef.current) {
        context.log(
          "[WAITING_DEPOSIT] 60s elapsed, no payin — switching to polling",
        );
        if (pusherUnsubscribeRef.current) {
          pusherUnsubscribeRef.current();
        }
        pusherFallbackEnabledRef.current = false;
        setPusherFallbackEnabled(false);
        setPayinPollingEnabled(true);
      }
      payinTimeoutIdRef.current = null;
    }, 60000);

    return () => {
      if (payinTimeoutIdRef.current) {
        clearTimeout(payinTimeoutIdRef.current);
        payinTimeoutIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePaymentId, pusherFallbackEnabled]);
```

- [ ] **Step 7: Add the per-`externalId` reset effect**

Add after the timer effect. On a NEW active id (QR refresh / deposit option switch), re-arm from scratch:

```typescript
  // When the active deposit id changes (QR refresh / option switch), reset the
  // fallback: re-enable Pusher, disable polling, clear the detection guard.
  useEffect(() => {
    if (
      prevActivePaymentIdRef.current &&
      prevActivePaymentIdRef.current !== activePaymentId
    ) {
      context.log("[WAITING_DEPOSIT] Active id changed — resetting fallback");
      payinDetectedRef.current = false;
      pusherFallbackEnabledRef.current = true;
      setPusherFallbackEnabled(true);
      setPayinPollingEnabled(false);
      if (payinTimeoutIdRef.current) {
        clearTimeout(payinTimeoutIdRef.current);
        payinTimeoutIdRef.current = null;
      }
    }
    prevActivePaymentIdRef.current = activePaymentId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePaymentId]);
```

- [ ] **Step 8: Wire `usePayinPolling` and route its result through the shared handler**

Add after the reset effect:

```typescript
  const { payinTxHash: polledPayinTxHash } = usePayinPolling({
    enabled: payinPollingEnabled && !!activePaymentId,
    rozoPaymentId: activePaymentId,
    log: context.log,
  });

  useEffect(() => {
    if (polledPayinTxHash) {
      handlePayinDetected(polledPayinTxHash, activePaymentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polledPayinTxHash]);
```

- [ ] **Step 9: Add the import**

At the top with the other hook imports (near line 28, `useRozoPay` import), add:

```typescript
import { usePayinPolling } from "../../../hooks/usePayinPolling";
```

- [ ] **Step 10: Lint**

Run: `cd packages/connectkit && pnpm lint`
Expected: no new errors. If oxlint flags the intentional `activePaymentId` in a deps array, the `eslint-disable-next-line` comments already cover it — confirm none are missing.

- [ ] **Step 11: Build**

Run: `cd packages/connectkit && pnpm build`
Expected: rollup completes, no TypeScript errors. Watch specifically for: unused `pusherConditionsMet`, type mismatch on `setPaymentCompleted` args, or `NodeJS.Timeout` typing (already used elsewhere in file — should resolve).

- [ ] **Step 12: Commit**

```bash
git add packages/connectkit/src/components/Pages/WaitingDepositAddress/index.tsx
git commit -m "feat(connectkit): 60s poll fallback for deposit payin detection"
```

---

## Task 3: Manual verification via example app

**Files:** none (verification only).

No automated tests exist for these components. Verify behavior in the running app.

- [ ] **Step 1: Start SDK + example app**

Two terminals:
```bash
# Terminal 1
cd packages/connectkit && pnpm dev
# Terminal 2
cd examples/nextjs-app && pnpm dev
```

- [ ] **Step 2: Happy path — Pusher still instant**

Open the pay modal → pick a deposit-address method → get QR. Complete the transfer (or trigger the backend payin). Confirm it routes to CONFIRMATION immediately via Pusher (check console for `[PAYIN DETECTED]`, NOT `switching to polling`). No regression.

- [ ] **Step 3: Pusher failure → poll fallback**

In DevTools, block the Pusher WS host (Network request-blocking on `*.pusher.com` / `ws-us2.pusher.com`) BEFORE opening the QR. Get the QR, send the deposit. Wait ~60s. Confirm console shows `60s elapsed, no payin — switching to polling`, then `Found payin transaction`, then routes to CONFIRMATION with a valid tx hash link.

- [ ] **Step 4: QR refresh mid-wait resets timer**

Open QR, wait ~50s, click Refresh (or switch deposit option) to mint a new `externalId`. Confirm console shows `Active id changed — resetting fallback` and a fresh `Arming 60s payin fallback timer` — the poll must NOT fire against the old id right after refresh.

- [ ] **Step 5: Report results**

Note pass/fail per step. If any fail, do NOT proceed — debug against the spec's data-flow diagram.

---

## Self-Review

**Spec coverage:**
- New `usePayinPolling` hook → Task 1. ✓
- Pusher gated on flag → Task 2 Step 3-4. ✓
- 60s timer per externalId → Task 2 Step 6. ✓
- Per-externalId reset → Task 2 Step 7. ✓
- Shared guarded `handlePayinDetected` (6 steps) → Task 2 Step 2. ✓
- Poll result wired → Task 2 Step 8. ✓
- `source.txHash` detection → Task 1 Step 1. ✓
- Unsubscribe-on-fallback → Task 2 Step 6. ✓
- Error handling (log + reschedule) → Task 1 Step 1 `catch`. ✓
- Manual test plan → Task 3. ✓

**Placeholder scan:** none — all code shown in full.

**Type consistency:** `handlePayinDetected(txHash, paymentId?)` defined Task 2 Step 2, called Step 4 & Step 8 with matching args. `usePayinPolling` signature identical across Task 1 (def) and Task 2 Step 8 (call). `activePaymentId` defined Step 1, used Steps 4/6/7/8. `pusherConditionsMet` renamed once (Step 3), consumed once (Step 4). Consistent.

**Known caveat carried from spec:** field name `source.txHash` verified in Task 1 Step 2 before use — if the v2 type differs, that step catches it.
