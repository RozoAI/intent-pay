# Troubleshooting

Known issues and the fix for each. Every entry here cost at least one debugging
session.

---

## Gotchas table

| Symptom                                                           | Cause                                                                                                                                                                                                | Fix                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `phantom.unlock()` times out waiting for `input[name='password']` | Phantom's cached profile starts **unlocked**. `unlock()` blindly fills the password field and times out when the lock screen isn't shown.                                                            | Use `unlockPhantomIfNeeded()` — it checks whether the lock screen is visible before unlocking.                                                                                             |
| Clicking `/ethereum/i` or `/solana/i` times out                   | The chain picker only renders when a multi-chain wallet is connected **and** both EVM and Solana are offered. When only one chain is relevant, the SDK connects directly without showing the picker. | Already handled in the helpers via `clickIfVisible()`. Don't assert presence of the chain picker in your own code.                                                                         |
| `connectToApp()` throws `Target page/context closed`              | The extension auto-closes its popup immediately after the user approves the connection. This is normal browser extension behavior.                                                                   | Swallow only errors matching `/closed/i`. The subsequent option-list assertion (`toBeVisible`) proves the connection succeeded.                                                            |
| `StellarWalletsKit custom element is already registered`          | `StellarWalletsKit` registers a browser custom element on construction. Constructing a second instance on the same page throws this error.                                                           | Use the singleton pattern in `createHeadlessStellarKit` (the `cachedKit` variable). Build the kit only once, inside the provider's `useState` initializer.                                 |
| Importing the Stellar kit in a spec file breaks the test runner   | The kit transitively imports `@stellar/freighter-api`, which is browser-only and fails under Node's ESM loader.                                                                                      | Import the wallet name and id from `e2e-stellar-constants.ts` only. That file has no kit imports. Never import from `e2e-stellar-kit.ts` in spec files.                                    |
| Checkout flow fails with `missingAppId` during fee calculation    | The payId-based button variant carries no `appId` prop. An older SDK version read `appId` from component props, which are absent in this path.                                                       | Fixed in SDK: fee calls now prefer `order.metadata.appId`. Update to the version that includes this fix.                                                                                   |
| Running one flow inadvertently runs its entire dependency chain   | Playwright resolves `dependencies` automatically. Running `--project=checkout-evm-to-solana` without `--no-deps` will also execute `mocked`, `evm-to-stellar`, `stellar-to-evm`, etc.                | All per-flow `package.json` scripts already include `--no-deps`. Use them. If running `playwright test` directly, add `--no-deps` yourself.                                                |
| Real funds sent twice                                             | Playwright retried a failed test and re-ran the transaction.                                                                                                                                         | Keep `retries: 0` and `workers: 1` on every real-funds project. These are not suggestions — changing either will risk double-spending.                                                     |
| Stellar source wallet transaction rejected on-chain               | The source wallet is missing a USDC trustline, or doesn't have enough XLM to cover fees.                                                                                                             | Add a USDC trustline on the source wallet and ensure it holds sufficient XLM (for fees) and USDC (to send).                                                                                |
| The headless Stellar kit activates in a non-test browser session  | The app is reading `__E2E_STELLAR_SECRET__` from somewhere other than `window` — or a `NEXT_PUBLIC_*` env var is leaking the secret.                                                                 | Confirm the provider only reads `window.__E2E_STELLAR_SECRET__` inside a `typeof window !== "undefined"` guard. Never pass the Stellar secret through any env var the app bundle can read. |
| `pnpm setup-wallets` fails or produces a stale profile            | The seed phrase changed, the chainwright version bumped, or the extension version changed under the cached profile.                                                                                  | Delete the `.chainwright` cache directory and re-run `pnpm setup-wallets -f`.                                                                                                              |
| Source token option never becomes visible (120 s timeout)         | The wallet isn't connected, or the SDK is waiting on a slow RPC response to load the token list.                                                                                                     | Check the browser console for RPC errors. Confirm the wallet connected by asserting `rozopay-options-list` is visible after `connectToApp()`.                                              |

---

## Security checklist

Run through this before committing any E2E-related code.

- **Throwaway wallets only.** Never use wallets that hold meaningful funds or
  are connected to any production service.
- **`.env.e2e` is gitignored.** Secrets must never enter version control.
  Double-check with `git status` before every commit.
- **Stellar secret stays out of the app bundle.** The secret is injected at
  runtime by Playwright via `addInitScript`. It must never appear in a
  `NEXT_PUBLIC_*` variable, a server-side env var the client reads, or any
  file that gets bundled.
- **Stellar destination wallets need a USDC trustline.** A Stellar account
  that has never held USDC will reject the payout. Set up the trustline on
  any destination address before running tests.
- **Solana wallet must be on mainnet.** The phantom wallet setup uses
  `toggleNetworkMode: { mode: "off" }` to force mainnet. Verify this is
  still present in `wallet-setup/phantom.setup.ts` after any wallet-setup
  changes.
- **Minimum deposit is 0.1 USDC.** Deposit-mode flows will fail at the SDK
  amount screen if you pass a smaller value to `enterDepositAmount` or
  `payInWithStellarHeadlessDeposit`.

---

## Next steps

- [10-running.md](./10-running.md) — CLI commands and CI setup
- [07-helpers.md](./07-helpers.md) — full `helpers.ts` source
- [README.md](./README.md) — index of all docs
