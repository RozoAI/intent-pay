# Playground Design Spec
_2026-05-30_

## Overview

New standalone developer playground at `examples/playground/`. Fresh Next.js 16 app — no legacy code from `examples/nextjs-app`. Target audience: external developers evaluating or integrating `@rozoai/intent-pay`. Goal: pick a scenario, configure params, see live `RozoPayButton`, copy working code.

---

## Tech Stack

| Tool | Version |
|---|---|
| Next.js | 16.2.6 (App Router) |
| Tailwind CSS | v4 |
| shadcn/ui | latest |
| TypeScript | latest |
| Package manager | pnpm (workspace member) |

Consumes `@rozoai/intent-pay` and `@rozoai/intent-common` as local workspace packages.

---

## Layout

Single route: `/` (index page of the playground app).

```
┌─────────────────────────────────────────────────────────┐
│ Header: "Rozo Pay Playground"                           │
├──────────────────────┬──────────────────────────────────┤
│ Sidebar (320px)      │ Main area                        │
│                      │                                  │
│ [Bridge]             │ [Preview] [Code]                 │
│ [Online Checkout]    │                                  │
│ [Wallet Deposit]     │  Preview tab:                    │
│                      │    Live RozoPayButton             │
│ ─────────────────    │    + event log                   │
│                      │                                  │
│ Param Form           │  Code tab:                       │
│  toChain             │    Syntax-highlighted snippet    │
│  toToken             │    Copy button                   │
│  toAddress           │                                  │
│  toUnits*            │                                  │
│                      │                                  │
│ [Action Button]      │                                  │
└──────────────────────┴──────────────────────────────────┘
* toUnits hidden for Wallet Deposit mode
```

---

## Scenarios

### 1. Bridge

The core SDK use case. User pays from any chain/token, recipient gets specified token on specified chain.

**Config fields:** `toChain`, `toToken`, `toAddress`, `toUnits`

**Flow:**
1. User fills form → form valid → `resetPayment()` fires (button disabled during this)
2. `resetPayment()` resolves → `RozoPayButton.Custom` enabled
3. User clicks → payment modal opens
4. Callbacks: `onPaymentStarted`, `onPaymentCompleted`, `onPayoutCompleted`

**localStorage key:** `playground-bridge`

---

### 2. Online Checkout

Merchant-style flow. Payment is pre-created server-side (simulated here), SDK tracks it by `paymentId`.

**Config fields:** `toChain`, `toToken`, `toAddress`, `toUnits`

**Flow:**
1. User fills form → "Create Payment" button appears
2. User clicks "Create Payment" → calls `createPayment()` from `@rozoai/intent-common` → receives `paymentId`
3. `RozoPayButton.Custom` renders with `payId={paymentId}` — **key prop set to `paymentId`** to force remount on change
4. Config change → clears `paymentId` → "Create Payment" button shown again (no auto-recreate)
5. Callbacks: `onPaymentStarted`, `onPaymentCompleted`, `onPayoutCompleted`

**Why remount:** SDK doesn't yet handle live `payId` prop updates stably. Keying on `paymentId` forces full remount, avoiding stale state.

**localStorage key:** `playground-checkout`

---

### 3. Wallet Deposit

User deposits into their own address — amount chosen inside SDK modal, not pre-specified.

**Config fields:** `toChain`, `toToken`, `toAddress` (`toUnits` omitted entirely)

**Flow:** Identical to Bridge minus `toUnits`. `resetPayment()` called without `toUnits`. Button disabled during reset.

**localStorage key:** `playground-deposit`

---

## Component Structure

```
examples/playground/
├── package.json
├── next.config.ts
├── tailwind.config.ts        (v4 style)
├── components.json           (shadcn config)
├── src/
│   ├── app/
│   │   ├── layout.tsx        (providers: RozoPayProvider, QueryClient)
│   │   └── page.tsx          (layout shell, scenario state)
│   ├── components/
│   │   ├── ScenarioTabs.tsx  (Bridge / Checkout / Deposit selector)
│   │   ├── ParamForm.tsx     (shared form — chain/token/address/amount)
│   │   ├── BridgeMode.tsx    (resetPayment logic + RozoPayButton)
│   │   ├── CheckoutMode.tsx  (createPayment + paymentId + remount)
│   │   ├── DepositMode.tsx   (Bridge without toUnits)
│   │   ├── PreviewPane.tsx   (live button + event log)
│   │   ├── CodeSnippet.tsx   (syntax highlight + copy)
│   │   └── EventLog.tsx      (live callback event feed)
│   ├── hooks/
│   │   └── usePlaygroundConfig.ts  (localStorage r/w, per-scenario key)
│   └── lib/
│       └── snippets.ts       (code generation per scenario)
```

---

## usePlaygroundConfig Hook

```ts
usePlaygroundConfig<T>(key: string, defaults: T): [T, (v: T) => void]
```

- Reads from `localStorage` on mount (SSR-safe: skip on server)
- Writes on every config change
- Separate key per scenario: `playground-bridge`, `playground-checkout`, `playground-deposit`

---

## Code Snippet Generation

`lib/snippets.ts` exports one function per scenario:

```ts
generateBridgeSnippet(config: BridgeConfig): string
generateCheckoutSnippet(config: CheckoutConfig): string
generateDepositSnippet(config: DepositConfig): string
```

Each returns a complete, copyable TSX component showing:
- Correct imports from `@rozoai/intent-pay` and `@rozoai/intent-common`
- `RozoPayButton.Custom` with all required props
- `onPaymentStarted`, `onPaymentCompleted`, `onPayoutCompleted` callbacks
- `resetPayment` usage (Bridge + Deposit)
- `createPayment` + `payId` usage (Checkout)

Snippet updates live as form fields change. Rendered via `react-syntax-highlighter` (vscDarkPlus theme).

---

## Event Log

Small feed below the live button showing real callback events as they fire:

```
✓ onPaymentStarted  { paymentId: "0x..." }
✓ onPaymentCompleted { ... }
```

Cleared on scenario switch or config reset.

---

## pnpm Workspace Integration

`examples/playground/package.json` references local packages:

```json
{
  "@rozoai/intent-pay": "workspace:*",
  "@rozoai/intent-common": "workspace:*"
}
```

Added to root `pnpm-workspace.yaml` under `examples/playground`.

Dev command added to root `package.json`:
```json
"dev:playground": "pnpm --filter playground dev"
```

---

## What's Explicitly Out of Scope

- Authentication / appId management UI (hardcoded `APP_ID` like existing demo)
- Mobile responsive optimization (desktop-first, polish later)
- Dark mode
- Deployment / hosting config
