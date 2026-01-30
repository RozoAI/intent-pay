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

- `.cursorrules` - Comprehensive project documentation and patterns
- `packages/connectkit/PAYMENT_FLOW.md` - Detailed payment flow diagrams and state transitions
- `packages/connectkit/README.md` - Public SDK documentation
- `CHANGELOG.md` - Version history and changes

## Contract Information

Smart contracts are noncustodial and audited.

Location: `packages/contract/`

Audit: Nethermind, 2025 Apr (see README)

## License

BSD-2-Clause (see LICENSE file)

## Credits

Forked from:
1. Daimo Pay by Daimo (https://github.com/daimo-eth/pay)
2. ConnectKit by Family (https://family.co)
