# E2E Coverage Matrix

Which **source token/chain pairs** the real-funds payment-flow specs cover, per
mode. One ✅ = at least one funded spec exists for that source asset in that
mode. Cell text notes the exact source when it matters.

> Mocked-only coverage (negative paths, catalog rendering, wallet-cancel) is not
> listed here — see [13-negative-and-cancel.md](./13-negative-and-cancel.md).
> Every ✅ below moves **real mainnet funds**.

---

## Source asset × mode

| Source asset                                | Bridge | Checkout | Deposit | Merchant | Pay-to-address |
| ------------------------------------------- | :----: | :------: | :-----: | :------: | :------------: |
| EVM native ETH (Base)                       |   ✅   |    ✅    |   ✅    |    ✅    |       ✅       |
| EVM native BNB (BSC)                        |   ✅   |    ✅    |   ✅    |    ✅    |       ✅       |
| EVM native POL (Polygon)                    |        |          |         |    ✅    |                |
| EVM USDC (Base)                             |   ✅   |    ✅    |   ✅    |    ✅    |       ✅       |
| **EVM USDT (BSC, 56)**                      |        |    ✅    |         |    ✅    |                |
| Solana native SOL                           |   ✅   |    ✅    |   ✅    |    ✅    |                |
| Solana USDC                                 |   ✅   |    ✅    |   ✅    |    ✅    |     ✅ᶠⁱˣ     |
| **Solana USDT (501)**                       |        |    ✅    |         |    ✅    |                |
| Stellar native XLM                          |   ✅   |   ✅ᶠⁱˣ   |   ✅    |    ✅    |                |
| Stellar USDC                                |   ✅   |    ✅    |   ✅    |    ✅    |                |

`ᶠⁱˣ` = spec is registered but `test.fixme` (needs an SDK gap closed) — it does
not move funds today.

**New in this change (USDT):** `checkout-solana-usdt-to-evm`,
`checkout-bsc-usdt-to-evm`, `merchant-solana-usdt`, `merchant-bsc-usdt`. These
are the first non-USDC stablecoin sources in the SDK payment-flow suite.

### Chain-id note

The SDK renders a source option as `rozopay-option-{chainId}-{token}`:

- Solana stablecoins (USDC/USDT) are presented on **native Solana, chainId 501**
  (`501-Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` for USDT). The Intents
  settlement chain for Solana is **900** (`rozoSolana`), but the wallet option —
  `getWalletPaymentOptions` / `getSolanaPaymentOptions` — reports 501.
- BSC USDT is `56-0x55d398326f99059fF775485246999027B3197955`.

### Funding prerequisite (why a USDT spec can time out)

Both wallet option endpoints return **only tokens the wallet actually holds**
(balances, not a static catalog). A USDT spec therefore needs the throwaway
wallet funded with that token, or `rozopay-option-…` never renders and the pay-in
times out at `selectSourceToken`. The BSC path additionally needs BNB for gas.

---

## Full spec list

| Project                          | Mode           | Source → Destination                  | Spec                                                     |
| -------------------------------- | -------------- | ------------------------------------- | -------------------------------------------------------- |
| `evm-to-stellar`                 | Bridge         | EVM USDC (Base) → Stellar             | `bridge/evm-to-stellar.spec.ts`                          |
| `stellar-to-evm`                 | Bridge         | Stellar USDC → Base                   | `bridge/stellar-to-evm.spec.ts`                          |
| `stellar-to-solana`              | Bridge         | Stellar USDC → Solana                 | `bridge/stellar-to-solana.spec.ts`                       |
| `solana-to-stellar`              | Bridge         | Solana USDC → Stellar                 | `bridge/solana-to-stellar.spec.ts`                       |
| `solana-to-evm`                  | Bridge         | Solana USDC → Base                    | `bridge/solana-to-evm.spec.ts`                           |
| `evm-to-solana`                  | Bridge         | EVM USDC (Base) → Solana              | `bridge/evm-to-solana.spec.ts`                           |
| `bridge-evm-native`              | Bridge         | ETH (Base) / BNB (BSC) → dest         | `bridge/evm-native.spec.ts`                              |
| `bridge-solana-native`           | Bridge         | SOL → dest                            | `bridge/solana-native.spec.ts`                           |
| `bridge-stellar-native`          | Bridge         | XLM → Base                            | `bridge/stellar-native.spec.ts`                          |
| `checkout-evm-to-stellar`        | Checkout       | EVM USDC (Base) → Stellar             | `checkout/evm-to-stellar.spec.ts`                        |
| `checkout-evm-to-solana`         | Checkout       | EVM USDC (Base) → Solana              | `checkout/evm-to-solana.spec.ts`                         |
| `checkout-stellar-to-evm`        | Checkout       | Stellar USDC → Base                   | `checkout/stellar-to-evm.spec.ts`                        |
| `checkout-stellar-to-solana`     | Checkout       | Stellar USDC → Solana                 | `checkout/stellar-to-solana.spec.ts`                     |
| `checkout-solana-to-stellar`     | Checkout       | Solana USDC → Stellar                 | `checkout/solana-to-stellar.spec.ts`                     |
| `checkout-solana-to-evm`         | Checkout       | Solana USDC → Base                    | `checkout/solana-to-evm.spec.ts`                         |
| **`checkout-solana-usdt-to-evm`**| Checkout       | **Solana USDT → Base**                | `checkout/solana-usdt-to-evm.spec.ts`                    |
| **`checkout-bsc-usdt-to-evm`**   | Checkout       | **BSC USDT → Base**                   | `checkout/bsc-usdt-to-evm.spec.ts`                       |
| `checkout-evm-native`            | Checkout       | ETH (Base) / BNB (BSC) → Stellar      | `checkout/evm-native.spec.ts`                            |
| `checkout-solana-native`         | Checkout       | SOL → Base                            | `checkout/solana-native.spec.ts`                         |
| `checkout-stellar-native`        | Checkout       | XLM → Base (fixme)                    | `checkout/stellar-native.spec.ts`                        |
| `merchant-evm`                   | Merchant       | EVM USDC (Base) → merchant            | `merchant/evm.spec.ts`                                   |
| `merchant-solana`                | Merchant       | Solana USDC → merchant                | `merchant/solana.spec.ts`                                |
| `merchant-stellar`               | Merchant       | Stellar USDC → merchant               | `merchant/stellar.spec.ts`                               |
| `merchant-evm-native`            | Merchant       | ETH (Base) / BNB (BSC) → merchant     | `merchant/evm-native.spec.ts`                            |
| `merchant-solana-native`         | Merchant       | SOL → merchant                        | `merchant/solana-native.spec.ts`                         |
| `merchant-stellar-native`        | Merchant       | XLM → merchant                        | `merchant/stellar-native.spec.ts`                        |
| `merchant-polygon-native`        | Merchant       | POL (Polygon) → merchant              | `merchant/polygon-native.spec.ts`                        |
| **`merchant-solana-usdt`**       | Merchant       | **Solana USDT → merchant**            | `merchant/solana-usdt.spec.ts`                           |
| **`merchant-bsc-usdt`**          | Merchant       | **BSC USDT → merchant**               | `merchant/bsc-usdt.spec.ts`                              |
| `merchant-evm-pay-to-address`    | Pay-to-address | USDC on Base → merchant               | `pay-to-address/merchant-evm.spec.ts`                    |
| `merchant-evm-native-pay-to-address` | Pay-to-address | ETH (Base) / BNB (BSC) → merchant | `pay-to-address/merchant-evm-native.spec.ts`             |
| `merchant-solana-pay-to-address` | Pay-to-address | USDC on Solana → merchant (fixme)     | `pay-to-address/merchant-solana.spec.ts`                 |

Bridge/Deposit cross-chain matrix rows mirror Checkout above; both modes cover
the same USDC/native assets (see `playwright.config.ts` for the full project
list and dependency order).

---

## Known gaps

- **USDT has no Bridge or Deposit spec** — only Checkout and Merchant, added here.
- **EVM USDT is only covered on BSC.** USDT on Ethereum / Arbitrum / Polygon is a
  live source the proxy offers but no spec pays with it.
- **BSC USDC wallet pay-in is not covered** (only BSC native BNB and BSC USDT).
- **Native pay-to-address** covers EVM only; Solana/XLM pay-to-address is `fixme`
  (needs `@solana/web3.js` + a headless XLM signer).
