# Plan: remove EVM WalletConnect from `@rozoai/intent-pay`

Status: **IMPLEMENTED**.

## Goal

Remove EVM WalletConnect added by PR #64 / merge commit
`0b5ffc175839fe511925e2f561df61eb45d0dac0`, while preserving Stellar
WalletConnect and unrelated payment-flow fixes included in that merge.

## Why

PR #64 makes `getDefaultConfig()` eagerly add wagmi's EVM `walletConnect()`
connector. Consumer apps that also initialize Stellar WalletConnect through
`StellarWalletsKit` then create two WalletConnect Cores in one browser page.

Observed consumer impact:

- `WalletConnect Core is already initialized` warning;
- accumulating heartbeat listeners;
- LOBSTR mobile may submit a Stellar transaction but the browser-side request
  response is unreliable/stuck.

`@rozoai/intent-pay` must not create an EVM WalletConnect Core by default.
Stellar WalletConnect remains an SDK capability and continues using
`utils/stellar/singleton-import.ts` plus `utils/stellar/walletconnect.module.ts`.

## Scope boundary

Remove only EVM WalletConnect feature surface from PR #64:

- desktop WalletConnect QR route and connector;
- no-extension desktop wallet tiles that proxy through that QR route;
- EVM WalletConnect branding and recovery logic;
- public `walletConnectProjectId` config API and related README claims.

Keep:

- Stellar `WalletConnectModule`, its `UniversalProvider` singleton, and its
  tests;
- direct injected, Coinbase, Safe, Solana, Stellar, exchange, and deposit flows;
- PR #64 changes unrelated to EVM WalletConnect: token-option settling fix,
  confirmation narrowing, payment metadata fields, and payment hash helpers;
- current Stellar WalletConnect pending/sign-and-submit handling in
  `PayWithStellarToken` and `waitForPaymentSourceTxHash`.

## Implementation

### 1. Stop constructing EVM WalletConnect

**`packages/connectkit/src/defaultConnectors.ts`**

- Remove wagmi `walletConnect` import.
- Delete EVM-only `hardenConnector`, `hardenConnectorFactory`, and cached
  WalletConnect project/connector state.
- Remove `walletConnectProjectId` from `DefaultConnectorsProps` and from
  `defaultConnectors()` arguments.
- Delete browser-only `walletConnect({ projectId, showQrModal: false })`
  construction.
- Preserve `coinbaseWallet`, `injected`, optional Safe, caller-supplied
  `additionalConnectors`, and `dataSuffix` behavior unchanged.

**`packages/connectkit/src/defaultConfig.ts`**

- Remove exported `ROZO_WALLETCONNECT_PROJECT_ID`.
- Remove public `walletConnectProjectId?: string` from `DefaultConfigProps`,
  its default destructuring, and forwarding to `defaultConnectors()`.
- Do not replace it with another EVM connector option.

**`packages/connectkit/src/utils/stellar/singleton-import.ts`**

- Replace its import of `ROZO_WALLETCONNECT_PROJECT_ID` with a private Stellar
  WalletConnect project-ID constant in this module (same current value).
- Continue passing that value only to the Stellar `WalletConnectModule`.

This removes EVM Core construction without disabling Stellar pairing.

### 2. Delete EVM WalletConnect-only UI and routing

- Delete `packages/connectkit/src/components/Pages/ConnectWalletConnect/index.tsx`.
- In `packages/connectkit/src/constants/routes.ts`, remove
  `CONNECT_WALLETCONNECT`.
- In `packages/connectkit/src/components/RozoPayModal/index.tsx`, remove the
  page import, route map entry, and its back-navigation branch.
- In `packages/connectkit/src/components/Common/ConnectorList/index.tsx`,
  remove the desktop `isWalletConnectConnector()` route branch and the
  no-connector fallback-to-QR branch. Existing connector/deeplink/chain-picker
  behavior remains.

### 3. Remove EVM WalletConnect wallet-list and branding branches

**`packages/connectkit/src/wallets/useWallets.tsx`**

- Remove `WalletConnect` logo and `isWalletConnectConnector` imports.
- Remove the dedicated EVM WalletConnect wallet tile.
- Remove desktop no-extension fallback-stub creation and its
  `window.ethereum` / WalletConnect checks.
- Remove WalletConnect-specific mobile filtering comment/logic if it becomes
  dead after connector removal; keep ordinary injected mobile wallets and
  deeplinks.

**`packages/connectkit/src/wallets/walletConfigs.tsx`**

- Remove `walletConnectFallback` from `WalletConfigProps`.
- Remove fallback flags from Family, MetaMask, Rainbow, Trust, and OKX
  configurations. Keep their normal extension/mobile/deeplink metadata.

**`packages/connectkit/src/components/Pages/SelectMethod/index.tsx`** and
**`packages/connectkit/src/components/Common/OrderHeader/index.tsx`**

- Remove `WalletConnect` logo and `isWalletConnectConnector` imports.
- Delete EVM connected-wallet icon overrides; retain normal matched config,
  connector icon, and generic wallet-icon fallback behavior.

**`packages/connectkit/src/utils/index.ts`**

- Remove `isWalletConnectConnector` once all EVM references are gone.

### 4. Remove EVM-only transaction recovery, retain Stellar recovery

**`packages/connectkit/src/hooks/usePaymentState.ts`**

- Change `useAccount()` destructuring back to the EVM address only; remove
  `ethConnector`.
- Remove the `ethConnector?.id === "walletConnect"` race between
  `transactionPromise` and `waitForPaymentSourceTxHash`.
- Return to awaiting the EVM wallet transaction promise directly.
- Remove EVM-only recovery logging/state only if it becomes unused.

Do **not** delete `payment/waitForPaymentSourceTxHash.ts` or its tests:
`PayWithStellarToken` still uses it to recover/confirm Stellar WalletConnect
sign-and-submit flows.

### 5. Update docs and dependencies deliberately

- In `packages/connectkit/README.md`, remove:
  - `walletConnectProjectId` from provider setup;
  - desktop QR/default shared-project language;
  - WalletConnect from supported EVM wallets.
- Search public docs, examples, exported `.d.ts` sources, and changelog for
  the removed config prop/feature; update only matches that describe EVM
  WalletConnect.
- Do not remove `@reown/appkit`, `@walletconnect/sign-client`,
  `@walletconnect/universal-provider`, or `@walletconnect/types` from
  `packages/connectkit/package.json`: Stellar WalletConnect still imports them.
- Run `pnpm install --lockfile-only` only if dependency resolution changes;
  inspect `pnpm-lock.yaml` rather than forcing unrelated lock churn.

## Tests and verification

1. Add/update focused `packages/connectkit/test/defaultConnectors.test.ts`:
   - default connector factory includes Coinbase and injected connectors;
   - it never creates/returns connector ID `walletConnect`;
   - caller-provided `additionalConnectors` remain preserved.
2. Keep and run `test/walletconnect.module.test.ts`; it proves Stellar still
   initializes one `UniversalProvider` Core and reuses it in AppKit.
3. Run from repository root:

   ```bash
   pnpm --filter @rozoai/intent-pay test
   pnpm --filter @rozoai/intent-pay lint
   pnpm --filter @rozoai/intent-pay build
   pnpm --filter examples/nextjs-app test:gate
   pnpm --filter examples/nextjs-app test:pages
   ```

4. Manual example checks:
   - Desktop with extension: injected EVM wallet and Coinbase connect normally;
     no WalletConnect QR tile or route appears.
   - Desktop without extension: no fabricated WalletConnect fallback wallet
     tiles appear; existing exchange/deposit alternatives still work.
   - Stellar: select WalletConnect, pair a Stellar wallet, sign a transaction;
     no second EVM WalletConnect Core is initialized.
5. Browser console check: opening the SDK with Stellar WalletConnect must not
   log `WalletConnect Core is already initialized` or an EVM WalletConnect
   `display_uri` flow.

## Release note

This is a breaking behavioral change for consumers relying on SDK-provided EVM
WalletConnect. Document it in release notes and advise those consumers to pass
their own wagmi WalletConnect connector via `connectors` if they still need
EVM WalletConnect; SDK must not own that Core by default.
