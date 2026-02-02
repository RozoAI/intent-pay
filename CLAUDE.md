# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RozoAI Intent Pay SDK (`@rozoai/intent-pay`) is a cross-chain crypto payment React SDK enabling seamless payments from 1000+ tokens with single transactions. This is a fork of Daimo Pay, originally based on ConnectKit.

**Key capabilities:**
- Cross-chain payments (EVM, Solana, Stellar) in under 1 minute
- Single transaction flow - no multiple wallet steps
- Permissionless - never holds funds
- Works with major wallets and exchanges

## Development Commands

### Monorepo Commands (from root)

```bash
# Build both packages
pnpm build

# Development mode (all packages in parallel)
pnpm dev

# Development mode (specific packages)
pnpm dev:common    # Build @rozoai/intent-common in watch mode
pnpm dev:pay       # Build @rozoai/intent-pay in watch mode
pnpm dev:example   # Run Next.js example app

# Install dependencies
pnpm install:local

# Linting
pnpm run lint

# Release (build + publish both packages)
pnpm release

# Cleanup
pnpm clean          # Remove all node_modules
pnpm clean:deps     # Remove node_modules, dist, build, .next
pnpm clean:all      # Full cleanup including lockfile
```

### Package: @rozoai/intent-pay (packages/connectkit)

```bash
cd packages/connectkit

# Development with watch mode (uses rollup)
pnpm dev

# Build for production
pnpm build

# Lint
pnpm lint

# Release new version (uses bumpp)
pnpm release
```

### Package: @rozoai/intent-common (packages/pay-common)

```bash
cd packages/pay-common

# Development with watch mode (TypeScript)
pnpm dev

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

### Example App (examples/nextjs-app)

```bash
cd examples/nextjs-app

# Development (uses local packages via NEXT_USE_LOCAL_PACKAGES)
pnpm dev

# Build
pnpm build

# Start production server
pnpm start

# Lint
pnpm lint
```

### Smart Contracts (packages/contract)

Uses Foundry for Solidity development.

```bash
cd packages/contract

# See Makefile for available commands
make
```

## Architecture

### Monorepo Structure

- **packages/connectkit** - Main SDK package (`@rozoai/intent-pay`)
- **packages/pay-common** - Shared types and utilities (`@rozoai/intent-common`)
- **packages/contract** - Solidity smart contracts (Foundry project)
- **examples/nextjs-app** - Next.js integration example

### Core Architecture Patterns

#### 1. Payment State Machine (FSM)

Location: `packages/connectkit/src/payment/paymentFsm.ts`

State flow:
```
preview → payment_unpaid → payment_started → payment_completed/payment_bounced
```

**Critical rules:**
- Cannot go from `error` to `payment_unpaid` without providing order
- Cannot skip from `preview` to `payment_started` without going through `payment_unpaid`
- Cross-chain switches require resetting old payment to `payment_unpaid` before starting new one

See `packages/connectkit/PAYMENT_FLOW.md` for detailed state transition diagrams.

#### 2. Multi-Chain Provider System

Location: `packages/connectkit/src/provider/`

Three separate context providers:
- **Web3ContextProvider** - EVM chains via Wagmi v2
- **SolanaContextProvider** - Solana via @solana/wallet-adapter-react
- **StellarContextProvider** - Stellar via @stellar/stellar-sdk

**RozoPayProvider** wraps all three and provides unified interface.

#### 3. Payment Flow Routing

Location: `packages/connectkit/src/constants/routes.ts`

Modal navigation flow:
```
SELECT_METHOD → SELECT_TOKEN → SELECT_AMOUNT → WAITING_WALLET → CONFIRMATION
```

Alternative flows for Solana/Stellar, exchanges, and deposit addresses.

#### 4. Hooks-Based State Management

Main hooks (location: `packages/connectkit/src/hooks/`):

- **useRozoPay** (`useDaimoPay.tsx`) - Core payment management
  - `createPreviewOrder()` - Start new payment
  - `setPayId()` - Resume existing order
  - `hydrateOrder()` - Lock in payment details
  - `paySource()` - Trigger payment search
  - `payWallet()` - Execute wallet payment
  - `resetPayment()` - Reset and start new flow

- **useRozoPayStatus** (`useDaimoPayStatus.ts`) - Payment status tracking
  - Returns: payment_unpaid/started/completed/bounced

- **useRozoPayUI** (`useDaimoPayUI.tsx`) - UI state
  - `openRozoPay()` / `closeRozoPay()` - Modal control

- **usePaymentState** (`usePaymentState.ts`) - Payment parameters management
  - Manages `currPayParams` state
  - Handles payment reset logic
  - Clears selected options on reset

- **useTokenOptions** (`useTokenOptions.tsx`) - Token selection logic
  - Manages loading state for token options
  - Filters and sorts available tokens
  - Handles preferred tokens/chains

- **useStellarDestination** (`useStellarDestination.ts`) - Address routing
  - Derives destination address from payParams
  - Determines payment direction (Stellar ↔ EVM)
  - Returns memoized values based on payParams

#### 5. Payment Options System

**Wallet Payment Options** (`useWalletPaymentOptions.ts`):
- EVM wallets: MetaMask, Coinbase Wallet, Trust, Rainbow, etc.
- Solana wallets: Phantom, Backpack, Solflare
- Stellar wallets: Via stellar-wallets-kit
- Active chains: Base (8453), Polygon (137), Solana, Stellar

**External Payment Options** (`useExternalPaymentOptions.ts`):
- Exchanges: Coinbase, Binance, Lemon
- ZKP2P apps: Venmo, CashApp, MercadoPago, Revolut, Wise
- Other: RampNetwork, deposit addresses

### Component Structure

Location: `packages/connectkit/src/components/`

```
components/
├── DaimoPayButton/     # Main entry point - RozoPayButton component
├── DaimoPayModal/      # Payment modal container
├── Pages/              # Modal pages for each step
│   ├── SelectMethod/      # Choose payment method
│   ├── SelectToken/       # Choose token to pay with
│   ├── SelectAmount/      # Enter payment amount
│   ├── WaitingWallet/     # Wait for wallet confirmation
│   ├── Confirmation/      # Payment confirmed
│   ├── Stellar/           # Stellar-specific flows
│   │   └── PayWithStellarToken/
│   └── Solana/            # Solana-specific flows
│       └── PayWithSolanaToken/
├── Common/             # Reusable UI components
└── Spinners/          # Loading animations
```

### Key Configuration Files

- **packages/connectkit/src/defaultConfig.ts** - Auto-generates wagmi config for EVM chains
- **packages/connectkit/src/constants/rozoConfig.ts** - API URLs, token configs
- **packages/connectkit/src/constants/routes.ts** - Payment flow navigation
- **packages/connectkit/rollup.config.js** - Build configuration

### API Integration

Base URL: `intentapiv2.rozo.ai/functions/v1/`

Authentication via `appId` parameter passed to RozoPayButton.

### Cross-Chain Payment Handling

**Direct payment**: User pays on same chain as destination
**Cross-chain payment**: User pays on different chain, Rozo handles bridging

Logic: If `order.preferredChainId` exists and differs from selected token's chainId, use cross-chain flow via `createPayment()` API.

**Important**: When switching chains during an active payment, must transition old payment to `payment_unpaid` before starting new payment with `payment_started`.

## Common Development Tasks

### Adding Support for a New Chain

1. Add chain config to `defaultConfig.ts`
2. Add token options to `useTokenOptions.tsx`
3. Update wallet connectors if needed in `defaultConnectors.ts`
4. Test payment flow with example app

### Debugging Payment State Issues

1. Check payment FSM state in `paymentStore.ts`
2. Enable logging in payment components (look for `log?.()` statements)
3. Monitor state transitions in browser DevTools
4. Verify `payParams` are updating correctly
5. Check destination address derivation in `useStellarDestination`

Common issues documented in `packages/connectkit/PAYMENT_FLOW.md` under "Common Issues & Solutions".

### Testing Payment Flows

Use the Next.js example app:

```bash
# Terminal 1: Run SDK in dev mode
cd packages/connectkit
pnpm dev

# Terminal 2: Run example app
cd examples/nextjs-app
pnpm dev
```

Changes to SDK are immediately reflected in example app (hot reload).

Test different scenarios:
- EVM chain payments (Base, Polygon)
- Solana payments (USDC)
- Stellar payments (XLM, USDC)
- Cross-chain payments
- Different wallets
- Mobile deep-linking

## Important Implementation Notes

### Dependency Array Issues (Fixed in v0.0.22+)

Prior to v0.0.22, inline objects in RozoPayButton props caused infinite re-renders. Fixed by using `JSON.stringify()` in dependency arrays for:
- `metadata`
- `preferredTokens`
- `paymentOptions`

### State Management Patterns

Uses React Context + custom hooks pattern:
- Centralized state in `paymentStore.ts`
- Event-driven updates via `paymentEventEmitter.ts`
- Side effects in `paymentEffects.ts`

### Error Handling

Payment errors transition to `error` state. To recover:
1. Must provide both `paymentId` and `order` when calling `setPaymentUnpaid()`
2. Check if user rejected transaction vs. actual failure
3. Set appropriate error state: `RequestCancelled` or `RequestFailed`

### Theme System

Location: `packages/connectkit/src/styles/`

8 built-in themes: auto, web95, retro, soft, midnight, minimal, rounded, nouns

Custom themes via styled-components theme provider.

## Tech Stack

- **Frontend**: React 18+, TypeScript, styled-components
- **Web3 - EVM**: Wagmi v2, Viem v2, @tanstack/react-query v5
- **Web3 - Solana**: @solana/wallet-adapter-react, @solana/web3.js
- **Web3 - Stellar**: @stellar/stellar-sdk, @creit.tech/stellar-wallets-kit
- **UI**: Framer Motion (animations), QR code generation
- **API**: tRPC client
- **Build**: Rollup with TypeScript, terser
- **Contracts**: Foundry (Solidity)
- **Testing**: tape (for pay-common package)

## Entry Points

Main export: `packages/connectkit/src/index.ts`
- Exports: RozoPayProvider, RozoPayButton, hooks, utilities

World integration: `packages/connectkit/src/world.ts`
- For WorldCoin minikit integration

## Typical Usage Pattern

```tsx
import { RozoPayProvider, RozoPayButton } from '@rozoai/intent-pay';

// Wrap your app
<RozoPayProvider config={wagmiConfig}>
  <App />
</RozoPayProvider>

// Use the payment button
<RozoPayButton
  appId="your-app-id"
  toChain={8453} // Base
  toAddress="0x..."
  toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" // USDC on Base
  toUnits="1000000" // 1 USDC (6 decimals)
  onPaymentStarted={(event) => console.log(event)}
  onPaymentCompleted={(event) => console.log(event)}
/>
```

## Build System Notes

- Main package uses Rollup with TypeScript plugin
- Builds to `packages/connectkit/build/`
- Type declarations generated via rollup-plugin-dts
- Bundle analysis available via rollup-plugin-visualizer
- Watch mode in development for hot reload

## Husky & Pre-commit Hooks

Configured in `.husky/` directory with lint-staged.

Only lints files in `packages/connectkit/**/*.{js,jsx,ts,tsx}` on commit.

## Package Manager

**IMPORTANT**: This project uses pnpm with workspaces.

Always use `pnpm` (not npm or yarn).

Configured version: pnpm@10.26.0 (see packageManager field in root package.json)

## Git Workflow

Main branch: `master`

When creating PRs, target the `master` branch.

## Important Files to Reference

- **`.cursorrules`** - Comprehensive project documentation and patterns
- **`packages/connectkit/PAYMENT_FLOW.md`** - Detailed payment flow diagrams and state transitions
- **`packages/connectkit/README.md`** - Public SDK documentation
- **`CHANGELOG.md`** - Version history and changes
- **`docs/ARCHITECTURE.md`** - Deep dive into system architecture, state machine, multi-chain integration
- **`docs/TROUBLESHOOTING.md`** - Common issues, debugging steps, and solutions

## Contract Information

Smart contracts are noncustodial and audited.

Location: `packages/contract/`

Audit: Nethermind, 2025 Apr (see README)

## License

BSD-2-Clause (see LICENSE file)

## Critical Insights for AI Assistants

When working on this codebase, keep these architectural insights in mind:

### 1. State Machine is Sacred
**Location:** `packages/connectkit/src/payment/paymentFsm.ts:168-198`

The payment FSM has strict transition rules. NEVER:
- Skip states (preview → payment_started without payment_unpaid)
- Call `setPaymentUnpaid()` from `error` state without providing order
- Start new payment while old one is `payment_started` (must reset first)

**Why:** Violating FSM rules causes silent bugs, stuck payments, and user frustration.

### 2. Three Separate Wallet Systems
**Location:** `packages/connectkit/src/provider/DaimoPayProvider.tsx:495-523`

EVM, Solana, and Stellar run in PARALLEL with NO shared state. They only share the payment store.

**Implication:** When debugging wallet issues, check the specific provider (Web3/Solana/Stellar) - don't assume they behave the same way.

### 3. Cross-Chain = Backend Dependency
**Location:** `packages/pay-common/src/api/payment.ts:36-147`

Cross-chain payments don't bridge on-chain. They go through Rozo's backend API:
1. Frontend calls `createPayment()` API
2. Backend returns deposit address (source chain)
3. User sends to deposit address
4. Backend bridges to destination
5. Frontend polls for status

**Implication:** Cross-chain payments are NOT trustless. Users trust Rozo's infrastructure.

### 4. Component State ≠ FSM State
**Location:** `packages/connectkit/src/components/Pages/PayWithToken/index.tsx:131-172`

There are THREE layers of state:
- **Component state:** `PayState` enum (RequestingPayment, RequestFailed, etc.)
- **FSM state:** PaymentState type (preview, payment_unpaid, payment_started, etc.)
- **API state:** Backend payment status (pending, processing, completed)

These can diverge! Always validate FSM state via `store.getState().type` before critical operations.

### 5. Stale State is a Real Threat
**Location:** `packages/connectkit/src/components/Pages/Stellar/PayWithStellarToken/index.tsx`

React batches updates. Components can render with stale props. ALWAYS validate:
```typescript
if (!payParams) return; // Prevent using old destination address
if (!order?.externalId) return; // Prevent payment without order
```

**Why:** After `resetPayment()`, a component might execute with old `destinationAddress` before new state propagates. This sends funds to the wrong address.

### 6. Wallet Quirks Require Defensive Code
**Location:** `packages/connectkit/src/components/Pages/PayWithToken/index.tsx:132-168`

Real wallets have bugs:
- Rainbow: Reports wrong chain ID (ConnectorChainMismatchError)
- Phantom: Doesn't return to browser after signing
- Trust Wallet: Mobile deep-linking is inconsistent

**Pattern:** Try-catch with specific error handling + automatic retry for known issues.

### 7. Token Loading is the Performance Bottleneck
**Location:** `packages/connectkit/src/hooks/useTokenOptions.tsx:236-308`

On modal open, SDK makes 100+ RPC calls fetching balances across chains. This is the main UX pain point.

**Mitigation:** Smart refresh logic with debouncing, but still slow on first load.

**Improvement opportunity:** Pre-fetch balances on wallet connection, before modal opens.

### 8. Polling, Not WebSockets
**Location:** `packages/connectkit/src/payment/paymentEffects.ts`

Payment status updates use pure polling (every 2 seconds). No WebSocket support.

**Implication:** At scale (1000s of users), this creates significant backend load. Exponential backoff or WebSocket upgrade recommended.

### 9. Order Immutability is a Security Feature
Once `hydrateOrder()` is called, payment amount/destination cannot change without full reset.

**Why:** Prevents race condition where user approves amount X but transaction sends amount Y.

**Tradeoff:** Changing payment details feels "heavy" because it requires restarting the full flow.

### 10. Error Recovery Requires Order Context
**Pattern:**
```typescript
try {
  await payWithToken(option, store);
} catch (e) {
  // WRONG: Just update UI state
  setPayState(PayState.RequestCancelled);

  // CORRECT: Also reset FSM state with order context
  if (rozoPaymentId && order) {
    await setPaymentUnpaid(rozoPaymentId, order);
  }
}
```

## Common Pitfalls to Avoid

1. ❌ **Using `cat`, `grep`, `find` instead of Read/Grep/Glob tools** - Always use specialized tools
2. ❌ **Modifying FSM transitions without understanding full flow** - Read ARCHITECTURE.md first
3. ❌ **Assuming EVM/Solana/Stellar wallets behave the same** - They don't; check provider-specific code
4. ❌ **Skipping validation of `payParams` before payment** - Can send to wrong address/chain
5. ❌ **Not handling wallet-specific errors** - Rainbow, Phantom, etc. have unique quirks
6. ❌ **Adding new chains without testing cross-chain flow** - Must verify both direct and bridged paths
7. ❌ **Forgetting to update both component AND FSM state on error** - Causes stuck payments

## When Making Changes

**Before modifying payment flow:**
1. Read `docs/ARCHITECTURE.md` sections 1-2 (State Machine & Multi-Chain)
2. Check `docs/TROUBLESHOOTING.md` for related issues
3. Verify change doesn't violate FSM transition rules
4. Test with example app across EVM, Solana, Stellar

**Before adding new features:**
1. Check if it requires backend API changes (cross-chain operations do)
2. Consider impact on all three chain providers
3. Test wallet disconnect/reconnect scenarios
4. Profile token loading performance impact

**Before fixing bugs:**
1. Check TROUBLESHOOTING.md for known solutions
2. Enable logging (`log?.()` statements) to trace state
3. Verify FSM state matches component state
4. Test fix across different wallets (MetaMask, Phantom, Freighter)

## Credits

Forked from:
1. Daimo Pay by Daimo (https://github.com/daimo-eth/pay)
2. ConnectKit by Family (https://family.co)
