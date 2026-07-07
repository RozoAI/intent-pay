# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.34] - 2026-07-07

### &nbsp;&nbsp;&nbsp;🚀 Features

- **conneckit**: Enhance error handling in payment flows &nbsp;-&nbsp; by @akbarsaputrait [<samp>(e9d4c)</samp>](https://github.com/RozoAI/intent-pay/commit/e9d4cbf8)

---


## [0.1.33] - 2026-07-07

### &nbsp;&nbsp;&nbsp;🐞 Bug Fixes

- **connectkit**: Ensure fresh order state is used in payment flows and fee calculations &nbsp;-&nbsp; by @akbarsaputrait [<samp>(43466)</samp>](https://github.com/RozoAI/intent-pay/commit/434666ea)

---


## [0.1.32] - 2026-07-05

### &nbsp;&nbsp;&nbsp;🚀 Features

- **connectkit**:
  - Add useAutoConnectGate readiness helper &nbsp;-&nbsp; by @akbarsaputrait [<samp>(a88d5)</samp>](https://github.com/RozoAI/intent-pay/commit/a88d521d)
  - Add usePayinPolling fallback hook &nbsp;-&nbsp; by @akbarsaputrait [<samp>(f4dd4)</samp>](https://github.com/RozoAI/intent-pay/commit/f4dd43b5)
  - 60s poll fallback for deposit payin detection &nbsp;-&nbsp; by @akbarsaputrait [<samp>(7daff)</samp>](https://github.com/RozoAI/intent-pay/commit/7daff1da)

### &nbsp;&nbsp;&nbsp;🐞 Bug Fixes

- **connectkit**:
  - Gate auto-navigate on wallet+order readiness &nbsp;-&nbsp; by @akbarsaputrait [<samp>(593d1)</samp>](https://github.com/RozoAI/intent-pay/commit/593d164d)
  - Show spinner in SelectMethod while gate waits &nbsp;-&nbsp; by @akbarsaputrait [<samp>(13da0)</samp>](https://github.com/RozoAI/intent-pay/commit/13da0507)
  - Cover unhydrated/payout_completed in readiness gate &nbsp;-&nbsp; by @akbarsaputrait [<samp>(833a9)</samp>](https://github.com/RozoAI/intent-pay/commit/833a9294)
  - Reset payin poll hash when disabled &nbsp;-&nbsp; by @akbarsaputrait [<samp>(c045c)</samp>](https://github.com/RozoAI/intent-pay/commit/c045ce0d)

---


## [0.1.31] - 2026-07-01

### &nbsp;&nbsp;&nbsp;🚀 Features

- Check capabilities wallet for contract based dataSuffix &nbsp;-&nbsp; by @akbarsaputrait [<samp>(d67e3)</samp>](https://github.com/RozoAI/intent-pay/commit/d67e33c8)
- Support Base builder code attribution via dataSuffix &nbsp;-&nbsp; by @akbarsaputrait [<samp>(7e0fa)</samp>](https://github.com/RozoAI/intent-pay/commit/7e0faad2)
- Check capabilities wallet for contract based dataSuffix" &nbsp;-&nbsp; by @akbarsaputrait [<samp>(528bb)</samp>](https://github.com/RozoAI/intent-pay/commit/528bbf89)
- Enhance example app layout and provider for cookie management &nbsp;-&nbsp; by @akbarsaputrait [<samp>(4e17a)</samp>](https://github.com/RozoAI/intent-pay/commit/4e17abdc)

### &nbsp;&nbsp;&nbsp;🐞 Bug Fixes

- Use EIP-5792 writeContractsAsync for dataSuffix on Base App / Coinbase Wallet &nbsp;-&nbsp; by @akbarsaputrait [<samp>(9fee8)</samp>](https://github.com/RozoAI/intent-pay/commit/9fee8f60)
- Improve mobile wallet connection for Solana and EVM integration &nbsp;-&nbsp; by @akbarsaputrait [<samp>(1d9b6)</samp>](https://github.com/RozoAI/intent-pay/commit/1d9b6c36)

---


## [0.1.30] - 2026-06-29

### &nbsp;&nbsp;&nbsp;🚀 Features

- Remove same-chain e2e and add restricted env &nbsp;-&nbsp; by @akbarsaputrait [<samp>(c8f65)</samp>](https://github.com/RozoAI/intent-pay/commit/c8f65248)
- Support Base builder code attribution via dataSuffix &nbsp;-&nbsp; by @akbarsaputrait [<samp>(ed686)</samp>](https://github.com/RozoAI/intent-pay/commit/ed686953)
- Enhance Base builder code attribution with dataSuffix support in payment flow &nbsp;-&nbsp; by @akbarsaputrait [<samp>(dd66e)</samp>](https://github.com/RozoAI/intent-pay/commit/dd66ebbc)

---


## [0.1.29] - 2026-06-11

### &nbsp;&nbsp;&nbsp;🐞 Bug Fixes

- Revert see receipt button should appear by default &nbsp;-&nbsp; by @akbarsaputrait [<samp>(b54e4)</samp>](https://github.com/RozoAI/intent-pay/commit/b54e4f34)

---


## [0.1.28] - 2026-06-11

### &nbsp;&nbsp;&nbsp;🚀 Features

- E2E USDC Base to Stellar &nbsp;-&nbsp; by @akbarsaputrait [<samp>(3e441)</samp>](https://github.com/RozoAI/intent-pay/commit/3e441067)
- E2E USDC Stellar to Base &nbsp;-&nbsp; by @akbarsaputrait [<samp>(e8e95)</samp>](https://github.com/RozoAI/intent-pay/commit/e8e95b88)
- E2E USDC Solana to Base/stellar &nbsp;-&nbsp; by @akbarsaputrait [<samp>(93c76)</samp>](https://github.com/RozoAI/intent-pay/commit/93c76d42)

---


## [0.1.27] - 2026-06-10

### &nbsp;&nbsp;&nbsp;🚀 Features

- Enhance payment tracking with analytics events for confirmation and payment states &nbsp;-&nbsp; by @akbarsaputrait [<samp>(aebb5)</samp>](https://github.com/RozoAI/intent-pay/commit/aebb5f63)
- Force to use checkout API if token switched and rozoPaymentId exist &nbsp;-&nbsp; by @akbarsaputrait [<samp>(96360)</samp>](https://github.com/RozoAI/intent-pay/commit/963600d1)
- Introduce new playground with preview and code toggle &nbsp;-&nbsp; by @akbarsaputrait [<samp>(6b125)</samp>](https://github.com/RozoAI/intent-pay/commit/6b125aaa)
- Improve playground state and snippet &nbsp;-&nbsp; by @akbarsaputrait [<samp>(545d8)</samp>](https://github.com/RozoAI/intent-pay/commit/545d8307)
- Add logo and favicon &nbsp;-&nbsp; by @akbarsaputrait [<samp>(43f5d)</samp>](https://github.com/RozoAI/intent-pay/commit/43f5da7c)
- Add resetPayId for checkout mode &nbsp;-&nbsp; by @akbarsaputrait [<samp>(38915)</samp>](https://github.com/RozoAI/intent-pay/commit/3891529d)
- Introduce "telemetry" props to prevent analytics and sanitize sensitive data &nbsp;-&nbsp; by @akbarsaputrait [<samp>(e0cdf)</samp>](https://github.com/RozoAI/intent-pay/commit/e0cdfadf)
- Add data-testid attributes to modal and options list for E2E testing &nbsp;-&nbsp; by @akbarsaputrait [<samp>(038ce)</samp>](https://github.com/RozoAI/intent-pay/commit/038ce874)
- Add e2e test on playground &nbsp;-&nbsp; by @akbarsaputrait [<samp>(00107)</samp>](https://github.com/RozoAI/intent-pay/commit/00107192)
- Add payment confirmed state on Confirmation modal &nbsp;-&nbsp; by @akbarsaputrait [<samp>(7dad9)</samp>](https://github.com/RozoAI/intent-pay/commit/7dad9f6b)

### &nbsp;&nbsp;&nbsp;🐞 Bug Fixes

- Build &nbsp;-&nbsp; by @akbarsaputrait [<samp>(28f1e)</samp>](https://github.com/RozoAI/intent-pay/commit/28f1e526)
- Use local playwright binary and make webServer opt-in via E2E_START_SERVER &nbsp;-&nbsp; by @akbarsaputrait [<samp>(bf52e)</samp>](https://github.com/RozoAI/intent-pay/commit/bf52e0d3)
- Update fee handling to check for null values and improve fee caching expiration &nbsp;-&nbsp; by @akbarsaputrait [<samp>(26fec)</samp>](https://github.com/RozoAI/intent-pay/commit/26fecc7d)
- **e2e**: Pay Now not rendered before config confirmed, assert not visible &nbsp;-&nbsp; by @akbarsaputrait [<samp>(8c13e)</samp>](https://github.com/RozoAI/intent-pay/commit/8c13e47f)

---


## [0.1.26] - 2026-06-02

### ✨ New Features

- **Payment validation error analytics** — Added `payment_validation_error` event to analytics, captured when validation fails both on button open and in `RozoPayProvider.showPayment`

### 🐛 Bug Fixes

- **Fix analytics amount field** — Use `toUnits` from `payParams` when available, falling back to `destFinalCallTokenAmount.usd` (was incorrectly using `.amount`)
- **Fix payment quote indentation bug** — Resolved misplaced try/catch block that caused `PAYMENT_QUOTE_RECEIVED` to fire outside the try scope
- **Fix Pusher unsubscribe ref** — Added `pusherUnsubscribe` to the `useEffect` dependency array instead of suppressing the lint rule
- **Fix `paymentState` dep in route effect** — Removed stale `paymentState` from dependency array to prevent unnecessary re-runs
- **Fix `preferredSymbol` re-render** — Wrapped `preferredSymbol` in `useMemo` in `BridgeMode` and `DepositMode` example components to prevent inline array recreation

### 🔧 Improvements

- **Decouple PostHog type** — Replaced direct `PostHog` import from `posthog-js` with a minimal local interface (`PostHogCapture`) in `AnalyticsProvider` and `RozoPayProvider`, removing the hard dependency on `posthog-js` types
- **Guard PostHog captures before init** — Added `__loaded` check before calling `posthog.capture()`, so events are silently dropped (no-op) if the consumer passes a PostHog instance that hasn't been initialized yet
- Updated `viem` to v2.52.0, `posthog-js` to v1.378.1, and various transitive dependency bumps

---

## [0.1.24] - 2026-06-01

### ✨ New Features

- **resetPayId for checkout mode** — Added ability to reset payment ID in checkout mode, enabling cleaner re-initiation of checkout flows
- **New example playground** — Replaced old playground with Next.js app featuring live preview and code snippet toggle
- **Logo and favicon** — Added logo and favicon to example app
- **PostHog analytics** — Enhanced payment tracking with analytics events for confirmation and payment state transitions; added `posthog-js` as optional peer dependency

### 🐛 Bug Fixes

- **Checkout API enforcement** — Force checkout API usage when token is switched and `rozoPaymentId` already exists, preventing stale payment state
- Fixed build issues

### 🔧 Improvements

- Updated `@rozoai/intent-common` to v0.1.18
- Updated `next` to v15.5.18 in example app
- Replaced playground with full Next.js example app (`examples/nextjs-app`)

---

## [0.1.22] - 2026-05-25

### ✨ New Features

- **HyperEVM support** — Added HyperEVM chain to the payment system

### 🔧 Improvements

- Updated package versions and dependency resolutions
- Removed WorldChain support (consolidated chain set)

### 🔒 Security

- Removed malicious code injection found in `tailwind.config.js`

---

## [0.1.21] - 2026-05-16

### ✨ New Features

- **WalletConnect upgrade** — Upgraded WalletConnect module with improved reliability
- **RozoPay rename** — Renamed all DaimoPay components and hooks to RozoPay for consistency and clarity

### 🐛 Bug Fixes

- Fixed `payerAddress` on payment completed
- Fixed `destinationAddress` for Solana payment to refer to payment state instead of stale prop
- Fixed filtered preferred tokens and prevented multiple checkout triggers
- Fixed `payId` props adjustment with checkout API

### 🔧 Improvements

- Updated dependencies and improved provider setup documentation
- Added cleanup plan for unused files and duplicate code consolidation

---

## [0.1.20] - 2026-05-08

### ✨ New Features

- Integrated `useRozoPayUI` for payment state management
- Added reset payment functionality in demo example

### 🐛 Bug Fixes

- Normalized chainId validation in config panel and demo examples to ensure proper address validation

### 🔧 Improvements

- Bumped version and updated dependencies
- Removed `feeType` from basic example
- Improved local storage handling

---

## [0.1.19] - 2026-04-25

### ✨ New Features

- Enhanced currency formatting across payment components

### 🔧 Improvements

- Improved payment option handling
- Added `RozoPayButton` props reference documentation
- Updated README with improved documentation

---

## [0.1.18] - 2026-04-16

### ✨ New Features

- Enhanced checkout page with configurable payment settings and improved payment button integration
- QR address support for mobile payment flows

### 🔧 Improvements

- Updated example app navigation and content layout for improved UX and accessibility
- Upgraded `@tanstack/react-query` to v5.95.0
- Added design context documentation for example app
- Updated `zod` dependency version

---

## [0.1.17] - 2026-03-11

### 🐛 Bug Fixes

- Fixed options loading — improved fallback configuration for deposit address options
- Improved error handling in bridge-utils for token and address validation
- Enhanced payment state management in Solana and Stellar components

### 🔧 Improvements

- Updated `@rozoai/intent-common` to v0.1.13
- Improved SVG components with unique IDs for better accessibility

---

## [0.1.16] - 2026-02-05

### ✨ New Features

- **Request ID tracking** — Added request ID to payment state management to prevent stale updates
- **Sender address tracking** — Enhanced payment state with sender address tracking

### 🐛 Bug Fixes

- Fixed race condition in payment state
- Fixed modal z-index handling for WalletConnect overlay
- Improved button transition styles
- Fixed duplicate Stellar wallet connection prompts

### 🔧 Improvements

- Added `knip` configuration for code analysis
- Enhanced Stellar wallet integration documentation
- Streamlined package scripts
- Added comprehensive architecture and troubleshooting documentation

---

## [0.1.15] - 2026-01-30

### ✨ New Features

- Added Solana deep link generation
- Added new wallet icons and image support

### 🐛 Bug Fixes

- Fixed loading state for payment options
- Fixed external Stellar kit race conditions and options state
- Fixed Stellar EURC payment state
- Fixed Pusher state and polling strategy

### 🔧 Improvements

- Refactored chain type validation to use `chain.type` instead of helper functions
- Updated package scripts to use pnpm
- Improved payment event handling
- Updated dependencies

---

## [0.1.10] - 2025-12-21

### 🐛 Bug Fixes

- Fixed pay-to-address with EURC token
- Fixed EURC mobile support

### ✨ New Features

- Added EURC support for mobile payments

---

## [0.1.7] - 2025-12-19

### ✨ New Features

#### EURC Token Support

- Added Base EURC token: `0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42`
- Added Stellar EURC token: `EURC:GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2`
- Enabled EURC bridging between Base and Stellar networks
- Updated token type definitions to include `NATIVE_EURC` token type

#### Preferred Token Configuration

- Added `preferredTokenAddress` support in wallet payment options
- Enhanced bridge configuration to support preferred token addresses
- Improved `preferredSymbol` to follow `supportedTokens` configuration
- Auto-detect preferred tokens across all chains and filter payment options

### 🐛 Bug Fixes

- Fixed `preferredTokens` props handling to properly respect explicit token preferences
- Resolved token filtering logic issues across different payment methods

### 🔧 Improvements

- Enhanced EVM payment options fetching logic
- Enhanced EURC-specific warning messages in demo pages

---

## [0.1.5] - 2025-12-17

### ✨ New Features

- **Pusher integration** — Enabled real-time payment status updates via Pusher (enabled by default)
- Implemented `updatePaymentPayInTxHash` on payment completion
- Extracted payout polling logic
- Improved wallet chain list selection and available tokens based on selected chain
- Added `receiverMemo` optional support

### 🐛 Bug Fixes

- Fixed Solana payment options
- Fixed deposit deeplink
- Fixed deposit token address and amount
- Fixed ESLint errors and added Husky lint-staged

### 🔧 Improvements

- Cleared cached payment options on payment completed
- Refreshed options on completed EVM wallet connector
- Improved token/chain logo on deposit options

---

## [0.1.4] - 2025-12-12

### ✨ New Features

- **Multiple chain token support** — Handle multiple chains' available tokens
- Support `exactOut` for precise payment amounts
- Improved payment event emitter for non-EVM chains

### 🐛 Bug Fixes

- Fixed `onPaymentCompleted` and `onPayoutCompleted` events
- Fixed payment options and connected wallet-only support
- Fixed Solana pay-in
- Fixed EVM switch token state

### 🔧 Improvements

- Improved payment event emitter for EVM chains

---

## [0.1.0] - 2025-12-02

### ✨ New Features

- **Multi-chain support** — Added ETH (Polygon), Solana payment flows
- Introduced new API for Manage Payment
- Created new payment API with adjusted supported tokens/chains
- Added `toAddress` unified prop (removed separate `toStellar` and `toSolana` props)
- Pay-in USDC on Ethereum
- BSC shown as default chain; validated `toChain` and `toToken`
- Improved Stellar payment and confirmation TX hash

---

## [0.0.42] - 2025-11-22

### ✨ New Features

- **WorldChain support** — Implemented USDC payments on WorldChain
- World minikit integration

---

## [0.0.40] - 2025-11-21

### ✨ New Features

- EVM pay without fee

### 🔧 Improvements

- Adjusted fee display and improved wallet options

---

## [0.0.37] - 2025-11-19

### ✨ New Features

- Implemented Stellar payment options via tRPC
- Implemented `onPayoutCompleted` hook
- Added EVM deeplink generation for pay-to-address
- Improved QR code pay-to-address
- Export Wagmi config

### 🐛 Bug Fixes

- Fixed `onPaymentStarted` trigger
- Fixed switch token/chain and payment options state

### 🔧 Improvements

- Moved API to common package, extracted API and bridge utils
- Improved error handlers and store state
- Improved external Stellar kit and states
- Improved Stellar singleton kit and wallet options
- Removed unused logos and chains to reduce build size
- Removed `daimoOrderId` reference

---

## [0.0.29] - 2025-10-15

### ✨ New Features

- Added WalletConnect to Stellar network
- Force chainId on EVM; fixed `connectedWalletOnly`

### 🔧 Improvements

- Improved wallet options logic
- Improved wallet balance caching and reduced state
- Improved logger, BNB and default decimal balance

---

## [0.0.26] - 2025-10-03

### ✨ New Features

- Added USDT BNB pay-to-address support
- Improved `showProcessingPayout` for MercadoPago

### 🐛 Bug Fixes

- Fixed `window` undefined (SSR)
- Fixed payment ID set correctly
- Fixed major issue: switch chain rehydrate

### 🔧 Improvements

- Migrated to bun for faster installs

---

## [0.0.25] - 2025-09-21

### ✨ New Features

- Added BNB payment options

---

## [0.0.24] - 2025-09-13

### 🐛 Bug Fixes

- Fixed infinite re-renders caused by inline object props in `RozoPayButton` — used `JSON.stringify()` in dependency arrays for `metadata`, `preferredTokens`, and `paymentOptions`

### 🔧 Improvements

- Excluded Daimo services; migrated to Rozo backend API

---

## [0.0.22] - 2025-09-01

### ✨ New Features

- Improved completed payment flow
- Added Freighter wallet support (Stellar)

---

## [0.0.21] - 2025-08-25

### 🔧 Improvements

- Improved Pay In/Out USDC on Solana

---

## [0.0.20] - 2025-08-21

### 🔧 Improvements

- Updated Rozo API URL

---

## [0.0.19] - 2025-08-21

### 🔧 Improvements

- Updated intent API URL

---

## [0.0.18] - 2025-08-21

### ✨ New Features

- Implemented Pay In USDC on Polygon and Solana
- Implemented Pay Out USDC on Base

---

## [0.0.17] - 2025-08-06

### ✨ New Features

- Added Stellar payment method
- Updated Stellar Expert URL

### 🐛 Bug Fixes

- Updated payment ID reference from `externalId` to `id`

---

## [0.0.15] - 2025-07-11

### 🔧 Improvements

- Rebranding and rebase with Daimo Pay latest version
- Removed global component; updated `intent-pay` package version

---

## [0.0.14] - 2025-07-07

### ✨ New Features

- Added Rozo logo assets
- Added `showSupport` prop to `PoweredByFooter`
- Added intercom; hidden TRX/ETH chains

### 🔧 Improvements

- Updated Daimo Pay upstream; minor improvements
- Improved GitHub workflow

---

## Support

For questions and support:

- 📧 [GitHub Issues](https://github.com/RozoAI/intent-pay/issues)
- 📖 [Documentation](https://github.com/RozoAI/intent-pay)
- 💬 [Discord Community](https://discord.gg/rozoai)
