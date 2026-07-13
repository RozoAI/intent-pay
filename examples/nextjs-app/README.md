# Intent Pay — Next.js Example App

Demo playground for the `@rozoai/intent-pay` SDK. Covers Bridge, Checkout,
Wallet Deposit, and Merchant payment flows with a full E2E test suite.

## Dev

```bash
pnpm dev          # start dev server at http://localhost:3000
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # oxlint
```

## E2E Tests

Tests live under `e2e/`. Two categories:

| Category          | Description                                                                     | Needs real funds? |
| ----------------- | ------------------------------------------------------------------------------- | ----------------- |
| **mocked**        | Headless, fast, no secrets needed                                               | No                |
| **payment-flows** | Real-funds flows across bridge / checkout / deposit / merchant / pay-to-address | Yes               |

### Quick start

```bash
# 1. Start the dev server
pnpm dev

# 2. Run a specific project (new tab)
node e2e/run.cjs <project>

# Or via pnpm (pnpm passes -- through to the script)
pnpm test:e2e -- <project>
```

### Common commands

```bash
# List all registered projects
pnpm test:e2e:list

# Run the fast mocked suite (no real funds, CI-safe)
pnpm test:e2e:mocked

# Run a specific project
pnpm test:e2e -- merchant-evm-pay-to-address

# Run with Playwright flags
pnpm test:e2e -- bridge-evm-native --headed
pnpm test:e2e -- mocked --grep "Create Payment"

# Open Playwright UI mode (interactive)
pnpm test:e2e:ui

# Run the full suite (all projects in dependency order)
pnpm test:e2e
```

### All projects

```
mocked

# bridge
evm-to-stellar          stellar-to-evm          stellar-to-solana
solana-to-stellar       solana-to-evm            evm-to-solana
bridge-evm-native       bridge-solana-native     bridge-stellar-native

# checkout
checkout-evm-to-stellar     checkout-evm-to-solana      checkout-stellar-to-evm
checkout-stellar-to-solana  checkout-solana-to-stellar  checkout-solana-to-evm
checkout-evm-native         checkout-solana-native      checkout-stellar-native

# merchant
merchant-evm            merchant-solana          merchant-stellar
merchant-evm-native     merchant-solana-native   merchant-stellar-native
merchant-polygon-native

# pay-to-address (merchant)
merchant-evm-pay-to-address
merchant-evm-native-pay-to-address
merchant-solana-pay-to-address          ← test.fixme (needs @solana/web3.js)

# deposit
deposit-stellar-to-evm      deposit-stellar-to-solana   deposit-evm-to-stellar
deposit-evm-to-solana       deposit-solana-to-stellar    deposit-solana-to-evm
deposit-evm-native          deposit-solana-native        deposit-stellar-native
```

Run `pnpm test:e2e:list` for the authoritative list.

### Setup for real-funds flows

1. Copy the env template and fill in secrets:

   ```bash
   cp .env.e2e.example .env.e2e
   ```

2. Build cached wallet profiles (MetaMask + Phantom):

   ```bash
   pnpm setup-wallets
   ```

3. Start the dev server and run a flow:

   ```bash
   pnpm dev &
   pnpm test:e2e -- bridge-evm-native
   ```

Required env vars per wallet type:

| Flow               | Required vars                                  |
| ------------------ | ---------------------------------------------- |
| EVM (MetaMask)     | `E2E_EVM_SEED_PHRASE`, `E2E_EVM_ADDRESS`       |
| Solana (Phantom)   | `E2E_SOLANA_SEED_PHRASE`, `E2E_SOLANA_ADDRESS` |
| Stellar (headless) | `E2E_STELLAR_SECRET`, `E2E_STELLAR_ADDRESS`    |
| Merchant flows     | `E2E_MERCHANT_APP_ID` + wallet vars above      |

### Maintaining the runner

`e2e/run.cjs` is the **single source of truth** for all project names.

When you add, rename, or remove a Playwright project you **must**:

1. Update the `PROJECTS` array in `e2e/run.cjs`
2. Add/update the project block in `e2e/playwright.config.ts`
3. Add/update the spec file under `e2e/payment-flows/<mode>/`
