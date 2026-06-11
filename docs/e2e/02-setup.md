# Setup

## Install

```bash
pnpm add -D @playwright/test@^1.60.0 chainwright@^0.9.12
```

The Stellar headless signer needs `@creit.tech/stellar-wallets-kit` and
`@stellar/stellar-sdk`. These are peer dependencies of `@rozoai/intent-pay` —
**pin them to the versions the SDK declares** so only one copy resolves in your
tree. A duplicate copy throws `StellarWalletsKit custom element is already registered`.

```bash
pnpm add @creit.tech/stellar-wallets-kit@^1.9.5 @stellar/stellar-sdk@^14.2.0
```

Verify with `pnpm why @creit.tech/stellar-wallets-kit`. If your app already
depends on these, reuse the same version — don't add a second one.

chainwright downloads extensions on demand. Supported: `metamask`, `phantom`,
`solflare`, `keplr`, `petra`, `meteor`.

---

## Directory layout

```
your-app/
  e2e/
    env.ts                      # central env loader
    helpers.ts                  # SDK pay-in helpers — copy from 07-helpers.md
    playwright.config.ts
    wallet-setup/
      metamask.setup.ts         # EVM cached profile
      phantom.setup.ts          # Solana cached profile
    payment-flows/
      bridge/
        evm-to-solana.spec.ts
        evm-to-stellar.spec.ts
        solana-to-evm.spec.ts
        solana-to-stellar.spec.ts
        stellar-to-evm.spec.ts
        stellar-to-solana.spec.ts
      checkout/                 # same 6 combos
      deposit/                  # same 6 combos
  lib/
    e2e-stellar-kit.ts          # headless Stellar signer
    e2e-stellar-constants.ts    # kit-free constants (ESM-safe)
  .env.e2e                      # secrets — gitignored
  .env.e2e.example              # template — committed
```

---

## Environment config (`e2e/env.ts`)

One module, imported everywhere (config, wallet setups, specs).

```ts
import { existsSync } from "node:fs"

for (const file of [".env.e2e", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file)
}

export const E2E = {
  amount: process.env.E2E_AMOUNT ?? "0.02",

  evm: {
    seedPhrase:     process.env.E2E_EVM_SEED_PHRASE ?? "",
    walletPassword: process.env.E2E_EVM_WALLET_PASSWORD ?? "TempE2ePassword123!",
    address:        process.env.E2E_EVM_ADDRESS ?? "",
    // rozopay-option-{chainId}-{tokenAddress} — default: Base USDC
    sourceOptionId: process.env.E2E_EVM_SOURCE_OPTION_ID ??
      "8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },

  stellar: {
    secret:  process.env.E2E_STELLAR_SECRET ?? "",
    address: process.env.E2E_STELLAR_ADDRESS ?? "",
  },

  solana: {
    seedPhrase:     process.env.E2E_SOLANA_SEED_PHRASE ?? "",
    walletPassword: process.env.E2E_SOLANA_WALLET_PASSWORD ?? "TempE2ePassword123!",
    address:        process.env.E2E_SOLANA_ADDRESS ?? "",
    // default: Solana USDC
    sourceOptionId: process.env.E2E_SOLANA_SOURCE_OPTION_ID ??
      "501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
} as const
```

---

## `.env.e2e.example`

Commit this file. Copy to `.env.e2e`, fill in, add `.env.e2e` to `.gitignore`.

```dotenv
E2E_AMOUNT=0.02

# EVM (MetaMask)
E2E_EVM_SEED_PHRASE=""
E2E_EVM_WALLET_PASSWORD=""
E2E_EVM_ADDRESS=
# E2E_EVM_SOURCE_OPTION_ID=8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913

# Stellar — secret injected at runtime; wallet needs XLM + USDC trustline
E2E_STELLAR_SECRET=
E2E_STELLAR_ADDRESS=

# Solana (Phantom)
E2E_SOLANA_SEED_PHRASE=""
E2E_SOLANA_WALLET_PASSWORD=""
E2E_SOLANA_ADDRESS=
# E2E_SOLANA_SOURCE_OPTION_ID=501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
```
