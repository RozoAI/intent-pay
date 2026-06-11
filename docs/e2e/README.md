# RozoPay E2E Docs

End-to-end testing guide for any app that embeds the RozoPay SDK (`@rozoai/intent-pay`).
Covers EVM, Solana, and Stellar source chains using [Playwright](https://playwright.dev) +
[chainwright](https://www.npmjs.com/package/chainwright).

> Tests run **real wallets on mainnet with real funds**. Use throwaway wallets with tiny
> balances. Never commit secrets.

## Documents

| File                                                 | What it covers                                         |
| ---------------------------------------------------- | ------------------------------------------------------ |
| [01-concepts.md](./01-concepts.md)                   | Two-halves model, signing strategy per chain           |
| [02-setup.md](./02-setup.md)                         | Install, directory layout, env config                  |
| [03-playwright-config.md](./03-playwright-config.md) | Playwright config + package.json scripts               |
| [04-wallet-evm.md](./04-wallet-evm.md)               | MetaMask setup + EVM spec skeleton                     |
| [05-wallet-solana.md](./05-wallet-solana.md)         | Phantom setup + Solana spec skeleton                   |
| [06-wallet-stellar.md](./06-wallet-stellar.md)       | Headless Stellar kit + provider wiring + spec skeleton |
| [07-helpers.md](./07-helpers.md)                     | `e2e/helpers.ts` — SDK pay-in helpers (copy verbatim)  |
| [08-payment-modes.md](./08-payment-modes.md)         | Bridge / Checkout / Deposit step-by-step               |
| [09-test-ids.md](./09-test-ids.md)                   | SDK `data-testid` reference                            |
| [10-running.md](./10-running.md)                     | CLI commands, CI setup                                 |
| [11-troubleshooting.md](./11-troubleshooting.md)     | Gotchas table + security checklist                     |

## Quick start

```bash
# 1. Install deps
pnpm add -D @playwright/test@^1.60.0 chainwright@^0.9.12

# 2. Copy env template and fill secrets
cp .env.e2e.example .env.e2e

# 3. Build cached wallet profiles
pnpm setup-wallets

# 4. Start your app, then run tests
pnpm dev
pnpm test:e2e
```

For detailed steps, start with [01-concepts.md](./01-concepts.md).
