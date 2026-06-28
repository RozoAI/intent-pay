/**
 * Shared constants for the E2E headless Stellar signer.
 *
 * Kept in their own file (free of @creit.tech/stellar-wallets-kit imports) so
 * the Playwright spec can import the wallet name without pulling in the kit —
 * which transitively loads @stellar/freighter-api and breaks under the test
 * runner's ESM loader.
 */
export const E2E_STELLAR_WALLET_ID = "e2e-headless"
export const E2E_STELLAR_WALLET_NAME = "E2E Headless Signer"
