# Running

## Local

```bash
# 1. Copy and fill secrets
cp .env.e2e.example .env.e2e

# 2. Build cached wallet extension profiles
pnpm setup-wallets

# 3. Start your app
pnpm dev

# 4. Run tests (separate terminal)
pnpm test:e2e                      # full suite: mocked → bridge → checkout → deposit
pnpm test:e2e:mocked               # non-payment tests only (no secrets needed)
pnpm test:e2e:stellar-to-evm       # one flow, isolated (--no-deps)
pnpm test:e2e:checkout-evm-to-solana  # one checkout flow, isolated
```

---

## CI

Set `E2E_START_SERVER=1` — Playwright boots the app via the `webServer` config
instead of requiring it to already be running.

Real-funds specs skip themselves automatically when their secret env var is absent:

```ts
test.skip(!E2E.evm.seedPhrase, "E2E_EVM_SEED_PHRASE not set")
```

A CI run with no wallet secrets will only execute the `mocked` project, which
is safe and requires no secrets. Add wallet secrets as CI environment variables
only when you intentionally want to run real-funds flows.

---

## Running a single flow

Every real-funds project has a `--no-deps` script (see
[03-playwright-config.md](./03-playwright-config.md)). Without `--no-deps`,
Playwright resolves the full `dependencies` chain and runs everything upstream
of the target project.

```bash
# Runs only stellar-to-evm, skips its dependency chain
pnpm test:e2e:stellar-to-evm

# Without --no-deps this would run: mocked → evm-to-stellar → stellar-to-evm
playwright test --config e2e/playwright.config.ts --project=stellar-to-evm
```
