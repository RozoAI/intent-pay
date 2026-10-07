# Native source tokens — E2E

Fundless coverage for native **source** tokens (ETH, BNB, POL, SOL, XLM):

- **mocked** (`deposit-catalog.spec.ts`) — deterministic, intercepts the SDK's
  tRPC `getDepositAddressOptions` call so the catalog is fully controlled. Runs
  in the `mocked` Playwright project (no wallet, no seed phrase, no real money).
- **viability** (`viability.spec.ts`) — real-backend dryrun quotes, no funds,
  off by default (see below).

Funded happy paths live in `e2e/payment-flows/**` (Layer B).

## Run

```bash
# just this suite
SKIP_ENV_VALIDATION=1 pnpm --filter examples/nextjs-app exec playwright test \
  --config e2e/playwright.config.ts --project=mocked e2e/native

# whole mocked project (this suite + existing smoke specs)
pnpm --filter examples/nextjs-app test:e2e:mocked
```

## What is asserted

`deposit-catalog.spec.ts` drives **Bridge → Pay Now → Pay to address** and pins
the SDK↔backend contract for native deposit catalogs:

- every supported native source renders with the API's own id/label
  (`ETH on Base`, `ETH on Ethereum`, `ETH on Arbitrum`, `POL on Polygon`,
  `BNB on BNB`, `SOL on Solana`, `XLM on Stellar`);
- the SDK **never synthesizes** native options the API omits (fail-closed
  contract) — the stablecoin-only case proves it by asserting a fallback-only
  row (`EURC on Base`) is absent, so the mocked catalog is the source of truth;
- XLM stays surfaced when no opt-in natives are present (XLM is exempt from
  merchant opt-in);
- the legacy proxy SOL sentinel (`11111111111111111111111111111112`) is accepted
  as native SOL;
- stablecoin options keep rendering unchanged next to natives (regression).

`fixtures.ts` holds the payload builders. Plain objects, no
`@rozoai/intent-common` import — the published package ships extensionless ESM
subpaths Playwright's transform cannot resolve, and the shapes mirror what
`intentapiv4.rozo.ai` actually returns (captured empirically).

## Viability probe (real backend, no funds)

`viability.spec.ts` drives Bridge → Pay to address (no wallet), selects each
candidate native source, and reads the live `/payment-api/payments?dryrun=true`
quote. Non-dryrun `createPayment` is aborted, so nothing is created and no funds
move. Off by default:

```bash
pnpm dev &
E2E_NATIVE_VIABILITY=true SKIP_ENV_VALIDATION=1 \
  pnpm --filter examples/nextjs-app exec playwright test \
    --config e2e/playwright.config.ts --project=mocked e2e/native/viability
```

Observed state (2025): ETH on Base, BNB on BNB, SOL on Solana **viable**; ETH on
Ethereum / Arbitrum **disabled**; POL on Polygon **absent**; XLM
**rejected** (`invalidTokenSymbol`). The spec asserts this table — flip it only
after an authorised backend change.

## Funded routes (Layer B)

Real-money happy paths live in `e2e/payment-flows/**` and are skipped unless the
wallet seed phrase is present. Native coverage now includes BNB (BSC) in bridge /
merchant / deposit, plus destination variety (ETH on Base → Arbitrum / Solana,
SOL → Stellar). Run a single project with e.g. `node e2e/run.cjs
bridge-evm-native`. These move real funds — never run without funded test
wallets and explicit intent.

## Not covered here

These need connectkit unit tests (or a funded run) rather than mocked E2E:

- atomic source amount + wrong-quote guards (`packages/connectkit` unit tests
  `nativeSourceApiPayloads`, `nativeSpendable`; plan Phase 4);
- insufficient spendable balance UX (unit tests + `payment-flows/**`);
- native deposit QR/deep-link URI format (needs a real `createPayment` round
  trip — `payment-flows/deposit/*-native.spec.ts`).
