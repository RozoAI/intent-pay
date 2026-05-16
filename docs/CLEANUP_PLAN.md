# Cleanup Plan: Unused Files & Duplicate Code

Identified via static analysis on `packages/connectkit/src` and `packages/pay-common/src`.

---

## 1. Unused Files — Safe to Delete

Files with zero imports across the entire codebase.

| # | File | Notes |
|---|------|-------|
| 1 | `packages/connectkit/src/assets/coins.tsx` | USDC, DAI SVG exports — never imported |
| 2 | `packages/connectkit/src/assets/rozo-dark.tsx` | `RozoDark` component — never imported |
| 3 | `packages/connectkit/src/assets/rozo-white.tsx` | `RozoWhite` component — never imported |
| 4 | `packages/connectkit/src/components/Common/SquareTimer.tsx` | Never imported; CircleTimer is used instead |
| 5 | `packages/connectkit/src/components/Pages/SelectMethod/styles.ts` | Exported styles never referenced |
| 6 | `packages/connectkit/src/hooks/useSolanaDestination.ts` | Hook never called anywhere |
| 7 | `packages/connectkit/src/hooks/useStellarDestination.ts` | Hook never called anywhere |
| 8 | `packages/connectkit/src/payment/paymentEventEmitter.ts` | Singleton never imported or used |
| 9 | `packages/connectkit/src/utils/wallets.ts` | 8 wallet detection functions — none imported |
| 10 | `packages/connectkit/src/world.ts` | Re-export only, never imported internally |

**Execution:**
```bash
cd packages/connectkit/src

rm assets/coins.tsx
rm assets/rozo-dark.tsx
rm assets/rozo-white.tsx
rm components/Common/SquareTimer.tsx
rm components/Pages/SelectMethod/styles.ts
rm hooks/useSolanaDestination.ts
rm hooks/useStellarDestination.ts
rm payment/paymentEventEmitter.ts
rm utils/wallets.ts
rm world.ts
```

> **Before deleting:** Verify none are re-exported via `index.ts` as public API surface. If exported from `index.ts`, remove those export lines too.

---

## 2. Dead Exported Symbol — Remove from Public API

| Symbol | File | Status |
|--------|------|--------|
| `useRozoPayStatus` | `packages/connectkit/src/hooks/useRozoPayStatus.ts` | Exported from `index.ts`, zero usage internally or by consumers |

**Execution:**
1. Remove `useRozoPayStatus` export line from `packages/connectkit/src/index.ts`
2. If no other code references the file, delete `useRozoPayStatus.ts` as well

---

## 3. Duplicate Code — Consolidate

### 3a. Address Validation (identical logic in 2 packages)

**Problem:** Same 4 functions implemented independently in both packages.

| Package | File | Functions |
|---------|------|-----------|
| connectkit | `src/types/chainAddress.ts:7-44` | `isValidEvmAddress`, `isValidSolanaAddress`, `isValidStellarAddress`, `validateAddressForChain` |
| pay-common | `src/validation.ts:26-58` | Same 4 functions |

**Fix:**
- Keep canonical version in `packages/pay-common/src/validation.ts` (shared package)
- In `connectkit/src/types/chainAddress.ts`, replace implementations with imports from `@rozoai/intent-common`
- Remove duplicate function bodies from `chainAddress.ts`

---

### 3b. Timer Countdown (3 near-identical `setInterval` implementations)

**Problem:** All three use `Math.ceil((target - Date.now()) / 1000)` with `setInterval(..., 1000)`.

| File | Lines | Context |
|------|-------|---------|
| `components/Common/CircleTimer.tsx` | 46–54 | Visual circle timer |
| `components/Common/SquareTimer.tsx` | 50–61 | Visual square timer — also unused (see §1) |
| `components/Pages/WaitingDepositAddress/index.tsx` | ~779 | Inline countdown in page component |

**Fix:**
- Extract shared `useCountdown(targetMs: number): number` hook to `hooks/useCountdown.ts`
- Replace inline logic in `CircleTimer` and `WaitingDepositAddress` with hook
- `SquareTimer` gets deleted anyway (§1)

---

### 3c. Error Handling (scattered `parseErrorMessage` across 14+ files)

**Problem:** No centralized error handler. `parseErrorMessage(error)` called in 14+ try-catch blocks with identical surrounding patterns.

| File | Approx. sites |
|------|--------------|
| `hooks/usePaymentState.ts` | lines 559, 600, 916, 1025, 1115, 1301, 1496 |
| `payment/paymentEffects.ts` | 5+ sites |
| `components/Pages/Stellar/PayWithStellarToken/index.tsx` | lines 305, 365 |
| 8+ other component files | various |

**Fix:**
- Create `utils/handlePaymentError.ts` — wraps try-catch + `parseErrorMessage` + FSM state reset into single utility
- Signature: `handlePaymentError(error: unknown, context?: { paymentId?: string; order?: Order }): void`
- Gradually replace repeated patterns; no need to do all at once

---

## Execution Order (Recommended)

1. **§1 — Delete unused files** — zero risk, zero refactor needed
2. **§2 — Remove dead export** — low risk, only index.ts change
3. **§3a — Consolidate validation** — medium effort, shared package already exists
4. **§3b — Extract useCountdown hook** — low effort, isolated
5. **§3c — Centralize error handling** — high effort, do incrementally

---

## Verification Checklist (before/after each step)

- [ ] `pnpm build` passes in root
- [ ] No TypeScript errors (`pnpm run lint`)
- [ ] Example app still runs (`cd examples/nextjs-app && pnpm dev`)
- [ ] No references to deleted files remain (`grep -r "filename" packages/`)
