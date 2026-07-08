/**
 * Central E2E config — single source of truth for env vars.
 *
 * Loads .env.e2e (everything test-side: wallets, amounts, addresses) and
 * .env.local (optional fallbacks for manual `pnpm dev`). Imported by
 * playwright.config, the chainwright wallet setup, and the flow specs, so env
 * is loaded the same way everywhere.
 *
 * Wallets are REUSABLE across flows: a wallet is the SOURCE in one direction
 * and the DESTINATION in the other. Example:
 *   EVM → Stellar : source = EVM wallet,     destination = a Stellar wallet
 *   Stellar → EVM : source = a Stellar wallet, destination = EVM wallet
 */
import { existsSync } from "node:fs"

// Load env files once, at import time. Guarded so a missing file is a no-op.
// .env.local is also auto-loaded by `next dev`; we load it here too so the test
// runner sees any NEXT_PUBLIC_* fallbacks for skip checks.
for (const file of [".env.e2e", ".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file)
}

// Base USDC — default EVM source token option id (rozopay-option-{chainId}-{token}).
const BASE_USDC_OPTION_ID = "8453-0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
const SOLANA_USDC_OPTION_ID = "501-EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
const TEMP_PASSWORD = "TempE2ePassword123!"

export const E2E = {
  /**
   * Set to run specs that call the live createPayment() API (checkout.spec.ts).
   * Off by default so the `mocked` project stays network-free and doesn't write
   * real payment rows to the production DB under the rozoDemo appId.
   */
  realApi: process.env.E2E_REAL_API === "true",

  /** USDC amount to send (human units), applies to every flow. */
  amount: process.env.E2E_AMOUNT ?? "0.02",

  /**
   * Amount to deposit in Deposit mode (human units). Deposit requires a minimum
   * of 0.1 USDC, so this is clamped to at least 0.1 even if E2E_AMOUNT is lower.
   * Set E2E_DEPOSIT_AMOUNT in .env.e2e to override independently.
   */
  get depositAmount(): string {
    const override = process.env.E2E_DEPOSIT_AMOUNT
    if (override) return override
    const base = Number(process.env.E2E_AMOUNT ?? "0.02")
    return String(Math.max(base, 0.1))
  },

  /** EVM wallet — driven by the MetaMask extension via chainwright. */
  evm: {
    seedPhrase: process.env.E2E_EVM_SEED_PHRASE,
    walletPassword: process.env.E2E_EVM_WALLET_PASSWORD ?? TEMP_PASSWORD,
    /** Public address — destination when paying TO an EVM chain. Must be set in .env.e2e. */
    address: process.env.E2E_EVM_ADDRESS,
    /** Source token to pay FROM when this wallet is the source (default Base USDC). */
    sourceOptionId: process.env.E2E_EVM_SOURCE_OPTION_ID ?? BASE_USDC_OPTION_ID,
  },

  /** Stellar wallet — driven by an in-page headless signer (no extension). */
  stellar: {
    /**
     * Single reusable wallet — its SECRET signs when Stellar is the source, its
     * ADDRESS receives when Stellar is the destination. Needs funds + a USDC
     * trustline. The test injects the secret into the app at runtime (see the
     * useStellarSigner helper) — it is never exposed to the app as an env var.
     */
    secret: process.env.E2E_STELLAR_SECRET,
    address: process.env.E2E_STELLAR_ADDRESS,
  },

  /**
   * Solana wallet — source via the Phantom extension (chainwright), destination
   * via its address. Uses rozoSolana (chainId 900) as the payout chain; the
   * source pay-in token lives on native Solana (chainId 501).
   */
  solana: {
    /** 12/24-word recovery phrase imported into Phantom. The source wallet — needs USDC. */
    seedPhrase: process.env.E2E_SOLANA_SEED_PHRASE,
    /** Local password to unlock the Phantom vault in the test profile. */
    walletPassword: process.env.E2E_SOLANA_WALLET_PASSWORD ?? TEMP_PASSWORD,
    /** Public address (Base58) — destination when paying TO Solana. Must be set in .env.e2e. */
    address: process.env.E2E_SOLANA_ADDRESS,
    /** Source token to pay FROM (rozopay-option-{chainId}-{mint}). Default = Solana USDC. */
    sourceOptionId:
      process.env.E2E_SOLANA_SOURCE_OPTION_ID ?? SOLANA_USDC_OPTION_ID,
  },

  /**
   * Merchant checkout — pays a payId created server-side via the merchant
   * endpoint (`/payment-api/payments/merchant`). Unlike Checkout mode, the
   * destination (chain/token/receiver) is fixed by the merchant's server config,
   * so tests only vary the SOURCE wallet. Skipped unless E2E_MERCHANT_APP_ID is
   * set, so runs never write real merchant orders unless opted in.
   */
  merchant: {
    /** Merchant appId (e.g. "pos_rozostudio"). Gates the merchant specs. */
    appId: process.env.E2E_MERCHANT_APP_ID,
    /** Merchant API base — defaults to the v4 host that serves the merchant endpoint. */
    apiUrl:
      process.env.E2E_MERCHANT_API_URL ??
      "https://intentapiv4.rozo.ai/functions/v1",
    /** Local-currency amount + code sent to the merchant endpoint. */
    amountLocal: process.env.E2E_MERCHANT_AMOUNT_LOCAL ?? "0.02",
    currencyLocal: process.env.E2E_MERCHANT_CURRENCY_LOCAL ?? "RM",
  },
} as const
