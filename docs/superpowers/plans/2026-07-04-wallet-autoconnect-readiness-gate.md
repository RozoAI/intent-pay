# Wallet Auto-Connect Readiness Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the modal opens with a wallet already connected, block navigation on wallet-settled + order-ready (FSM), show the reused spinner while waiting, route errors to the Error page, then land on a stable `SELECT_TOKEN` — killing the "refresh a few times" flash.

**Architecture:** One shared gate helper derives three booleans from wallet status + FSM state. The `RozoPayModal` auto-navigate effect consumes it to decide wait / navigate / error-route. `SelectMethod` consumes the same helper to render the reused spinner (instead of tiles) while the gate is waiting. Balance loading is untouched — stays progressive in `SelectToken`.

**Tech Stack:** React 18, wagmi v2 (`useAccount().status`), `@solana/wallet-adapter-react` (`useWallet().connecting`), styled-components. No new deps.

## Global Constraints

- Package: `packages/connectkit` (`@rozoai/intent-pay`). Use `pnpm`.
- Do NOT modify FSM transitions (`paymentFsm.ts`), tiles' `show*PaymentMethod` flags, chain-provider internals, or balance/fee loading.
- Reuse existing components — no new spinner/loading component. Loading visual = `components/Common/Spinner` (bare, no props).
- FSM state in the modal comes from `useRozoPay()`: `paymentState` is the **type string** (`"idle" | "preview" | "error" | "payment_*"`), `paymentErrorMessage` is the error string.
- `ROUTES.ERROR` reads its message from `routeMeta.error` (a `string`).
- No auto-commit/push. Commits in this plan are staged only if the user runs them; leave changes local otherwise per the repo's standing rule. (Steps show the commit command for completeness; do not run it unless the user asks.)
- No unit-test harness for render-timing races — verification is manual (Task 4).

---

### Task 1: Shared gate helper

**Files:**
- Create: `packages/connectkit/src/hooks/useAutoConnectGate.ts`

**Interfaces:**
- Consumes: `useAccount` (wagmi), `useWallet` (`@solana/wallet-adapter-react`), `useStellar` (`../provider/StellarContextProvider`), `useRozoPay` (`./useRozoPay`).
- Produces:
  ```ts
  function useAutoConnectGate(): {
    anyWalletConnected: boolean;   // eth || solana || stellar
    walletSettling: boolean;       // reconnect/connect/autoConnect in flight
    orderPending: boolean;         // FSM "idle"
    orderError: boolean;           // FSM "error"
    orderReady: boolean;           // FSM "preview" | "payment_*"
    // gateState: what the connected-wallet auto-connect path should do now.
    // "pass" when no wallet connected (gate is inert — caller shows tiles).
    gateState: "waiting" | "error" | "ready" | "pass";
    errorMessage: string | null;   // paymentErrorMessage when orderError
  };
  ```

- [ ] **Step 1: Create the helper**

Create `packages/connectkit/src/hooks/useAutoConnectGate.ts`:

```ts
import { useWallet } from "@solana/wallet-adapter-react";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useStellar } from "../provider/StellarContextProvider";
import { useRozoPay } from "./useRozoPay";

export type AutoConnectGateState = "waiting" | "error" | "ready" | "pass";

/**
 * Derives whether the modal's auto-connect path (wallet already connected on
 * open) is safe to navigate to SELECT_TOKEN. Blocks on two cheap, critical
 * signals — wallet reconnect settled + preview order resolved (from FSM) —
 * while balances load progressively later in SELECT_TOKEN. See
 * docs/superpowers/specs/2026-07-04-wallet-autoconnect-readiness-gate-design.md
 */
export function useAutoConnectGate() {
  const { isConnected: isEthConnected, status: ethStatus } = useAccount();
  const { connected: isSolanaConnected, connecting: isSolanaConnecting } =
    useWallet();
  const { isConnected: isStellarConnected } = useStellar();
  const { paymentState, paymentErrorMessage } = useRozoPay();

  return useMemo(() => {
    const anyWalletConnected =
      isEthConnected || isSolanaConnected || isStellarConnected;

    const walletSettling =
      ethStatus === "reconnecting" ||
      ethStatus === "connecting" ||
      isSolanaConnecting;

    const orderPending = paymentState === "idle";
    const orderError = paymentState === "error";
    const orderReady =
      paymentState === "preview" || paymentState.startsWith("payment_");

    let gateState: AutoConnectGateState;
    if (!anyWalletConnected) {
      gateState = "pass"; // gate inert — caller renders tiles as before
    } else if (walletSettling || orderPending) {
      gateState = "waiting";
    } else if (orderError) {
      gateState = "error";
    } else if (orderReady) {
      gateState = "ready";
    } else {
      // Defensive: unknown/transitional state → wait rather than flash tiles.
      gateState = "waiting";
    }

    return {
      anyWalletConnected,
      walletSettling,
      orderPending,
      orderError,
      orderReady,
      gateState,
      errorMessage: orderError ? paymentErrorMessage : null,
    };
  }, [
    isEthConnected,
    isSolanaConnected,
    isStellarConnected,
    ethStatus,
    isSolanaConnecting,
    paymentState,
    paymentErrorMessage,
  ]);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/connectkit && npx tsc --noEmit -p tsconfig.json 2>&1 | grep useAutoConnectGate`
Expected: no output (no errors referencing the new file). Pre-existing `node_modules/.pnpm/ox@...` error is unrelated and may appear in the full output — ignore it.

- [ ] **Step 3: Commit (only if user asks)**

```bash
git add packages/connectkit/src/hooks/useAutoConnectGate.ts
git commit -m "feat(connectkit): add useAutoConnectGate readiness helper"
```

---

### Task 2: Wire the gate into the modal's auto-navigate effect

**Files:**
- Modify: `packages/connectkit/src/components/RozoPayModal/index.tsx` (the `SELECT_METHOD` auto-navigate effect, currently ~lines 256-332)

**Interfaces:**
- Consumes: `useAutoConnectGate()` from Task 1; `solanaPaymentEligible` / `stellarPaymentEligible` from `paymentState` (already present in working tree); `ROUTES.ERROR`, `ROUTES.SELECT_TOKEN`.
- Produces: no new exports. Behavior: effect navigates only when `gateState === "ready"`, routes to ERROR when `"error"`, does nothing when `"waiting"` or `"pass"` (except `"pass"` keeps existing no-wallet behavior — which is "do nothing, tiles show").

**Context — the effect today (lines 256-332):** gates EVM on `isEthConnected`, Solana on `solanaPaymentEligible`, Stellar on `stellarPaymentEligible`, after early-returning while `ethStatus` is reconnecting/connecting or `isSolanaConnecting`. It does not handle `orderError` and can sit on `SELECT_METHOD` when the order hasn't resolved. This task replaces the early-return + navigation gating with the shared gate.

- [ ] **Step 1: Add the gate hook call**

Near the other hook calls (after `const { paymentState: paymentFsmState } = useRozoPay();`, ~line 90), add:

```ts
  const autoConnectGate = useAutoConnectGate();
```

And add the import at the top with the other hook imports:

```ts
import { useAutoConnectGate } from "../../hooks/useAutoConnectGate";
```

- [ ] **Step 2: Replace the effect's gating logic**

Replace the wallet-settling early-returns and the branch conditions. The effect becomes (keep the `context.open` / `context.route !== SELECT_METHOD` / explicit-back-navigation guards; replace the settling returns and branch gates):

```ts
  useEffect(() => {
    if (!context.open) return;
    if (context.route !== ROUTES.SELECT_METHOD) return;

    // Only auto-navigate on initial open, not when the user explicitly
    // navigated back to SELECT_METHOD from SELECT_TOKEN.
    const isExplicitBackNavigation =
      context.routeMeta?.event === "click-select-another-method";
    if (isExplicitBackNavigation) return;

    // Readiness gate (wallet settled + order resolved, from FSM).
    // "pass"    → no wallet connected: leave SELECT_METHOD showing tiles.
    // "waiting" → wait; SelectMethod renders the spinner meanwhile.
    // "error"   → route to the Error page with the FSM message.
    // "ready"   → navigate to SELECT_TOKEN for the connected wallet.
    if (autoConnectGate.gateState === "pass") return;
    if (autoConnectGate.gateState === "waiting") return;
    if (autoConnectGate.gateState === "error") {
      context.setRoute(ROUTES.ERROR, {
        error: autoConnectGate.errorMessage ?? undefined,
      });
      return;
    }

    // gateState === "ready": pick the token screen for the connected wallet.
    if (
      isEthConnected &&
      !isSolanaConnected &&
      !isStellarConnected &&
      (!isMobile || !disableMobileInjector)
    ) {
      paymentState.setTokenMode("evm");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "eth_connected_on_open",
        walletId: connector?.id,
        address,
      });
    } else if (
      isSolanaConnected &&
      !isStellarConnected &&
      !isEthConnected &&
      solanaPaymentEligible &&
      !disableMobileInjector
    ) {
      paymentState.setTokenMode("solana");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "solana_connected_on_open",
      });
    } else if (
      isStellarConnected &&
      !isEthConnected &&
      !isSolanaConnected &&
      stellarPaymentEligible &&
      !disableMobileInjector
    ) {
      paymentState.setTokenMode("stellar");
      context.setRoute(ROUTES.SELECT_TOKEN, {
        event: "stellar_connected_on_open",
      });
    }
    // Don't include context.route in deps or the user can't go back from
    // SELECT_TOKEN to SELECT_METHOD.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    context.open,
    autoConnectGate.gateState,
    autoConnectGate.errorMessage,
    isEthConnected,
    isSolanaConnected,
    isStellarConnected,
    solanaPaymentEligible,
    stellarPaymentEligible,
    address,
    chain?.id,
    connector?.id,
  ]);
```

- [ ] **Step 3: Remove now-unused destructures if any**

If `showSolanaPaymentMethod` / `showStellarPaymentMethod` are no longer referenced elsewhere in the modal file after this change, remove them from the `paymentState` destructure to avoid unused-var lint. (They are still used by `SelectMethod` tiles — only remove from `RozoPayModal` if unused *there*.) Verify with:

Run: `cd packages/connectkit && grep -n "showSolanaPaymentMethod\|showStellarPaymentMethod" src/components/RozoPayModal/index.tsx`
Expected: no matches → safe to remove from the destructure. If matches remain, leave them.

- [ ] **Step 4: Typecheck**

Run: `cd packages/connectkit && npx tsc --noEmit -p tsconfig.json 2>&1 | grep RozoPayModal`
Expected: no output. (Ignore the unrelated pre-existing `ox@...` node_modules error.)

- [ ] **Step 5: Commit (only if user asks)**

```bash
git add packages/connectkit/src/components/RozoPayModal/index.tsx
git commit -m "fix(connectkit): gate auto-navigate on wallet+order readiness"
```

---

### Task 3: Render the spinner in SelectMethod while gated

**Files:**
- Modify: `packages/connectkit/src/components/Pages/SelectMethod/index.tsx`

**Interfaces:**
- Consumes: `useAutoConnectGate()` from Task 1; existing `PageContent` (`../../Common/Modal/styles`); `Spinner` (`../../Common/Spinner`).
- Produces: no exports. Behavior: when `gateState === "waiting"`, render a centered spinner instead of the method tiles. All other states render tiles as before.

**Context:** `SelectMethod` currently always renders its tiles/options. When a wallet is connected but the order/reconnect hasn't settled, the modal effect is in `"waiting"` and does NOT navigate — so without this task, tiles flash. This task makes the waiting state show the reused spinner.

- [ ] **Step 1: Add imports**

At the top of `SelectMethod/index.tsx`, add:

```ts
import { Spinner } from "../../Common/Spinner";
import { useAutoConnectGate } from "../../../hooks/useAutoConnectGate";
```

(`PageContent` is already imported in this file at line 7 from `../../Common/Modal/styles` — no change needed.)

- [ ] **Step 2: Call the gate and early-return the spinner**

Inside the component, after the existing hook calls, add:

```ts
  const autoConnectGate = useAutoConnectGate();
```

Then, immediately before the component's main `return (`, add the waiting branch:

```ts
  // Wallet connected but reconnect/order not settled yet: show the reused
  // spinner instead of flashing method tiles. The modal's auto-navigate effect
  // moves us to SELECT_TOKEN (or ERROR) once the gate resolves.
  if (autoConnectGate.gateState === "waiting") {
    return (
      <PageContent>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 120,
          }}
        >
          <Spinner />
        </div>
      </PageContent>
    );
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd packages/connectkit && npx tsc --noEmit -p tsconfig.json 2>&1 | grep SelectMethod`
Expected: no output.

- [ ] **Step 4: Build the package**

Run: `cd packages/connectkit && pnpm build 2>&1 | tail -5`
Expected: build completes without errors.

- [ ] **Step 5: Commit (only if user asks)**

```bash
git add packages/connectkit/src/components/Pages/SelectMethod/index.tsx
git commit -m "fix(connectkit): show spinner in SelectMethod while gate waits"
```

---

### Task 4: Manual verification in example app

**Files:** none (verification only).

**Context:** No automated harness exists for this render-timing race. Verify against the real repro per the spec's Testing section.

- [ ] **Step 1: Run SDK watch + example app**

Two terminals:
```bash
cd packages/connectkit && pnpm dev
```
```bash
cd examples/nextjs-app && pnpm dev
```

- [ ] **Step 2: In-app browser repro (primary)**

Open the example app inside Phantom / Base App / MetaMask mobile in-app browser with a wallet connected. Open the pay modal repeatedly (5+ times).
Expected: lands on `SELECT_TOKEN` every time. Spinner shows while loading; **never** a `SELECT_METHOD` tile flash; never stuck.

- [ ] **Step 3: Order-error path**

Force a failed `createPreviewOrder()` (e.g. invalid `appId` or offline the order API), wallet connected, open modal.
Expected: routes to the Error page with a message. Does NOT spin forever, does NOT show a broken token screen.

- [ ] **Step 4: No-wallet regression**

Desktop, no in-app browser, no wallet connected. Open modal.
Expected: `SELECT_METHOD` appears immediately with method tiles. No spinner, no delay.

- [ ] **Step 5: Two-wallet regression (Race B)**

Phantom connecting both EVM + Solana. Open modal.
Expected: stays on `SELECT_METHOD` so the user picks a wallet (tiles do not auto-navigate; Race B behavior preserved). tokenModeExplicit still keeps their token lists separate after selection.

- [ ] **Step 6: Report results**

Record pass/fail for each of Steps 2-5. Any fail → return to systematic-debugging, do not paper over.

---

## Notes for the implementer

- The `solanaPaymentEligible` / `stellarPaymentEligible` memos already exist in `usePaymentState.ts` (added in a prior working-tree change) and are exported + typed. This plan keeps them. If a clean checkout lacks them, add order-independent eligibility memos mirroring `showSolanaPaymentMethod` / `showStellarPaymentMethod` minus the `pay.order != null` gate (Solana: `paymentOptions == null || includes(Solana)`; Stellar: same plus the `preferredTokens`-has-no-Stellar rule).
- Do not touch `show*PaymentMethod` — the SELECT_METHOD tiles still need the order gate because tapping a tile starts a payment.
