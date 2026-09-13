/**
 * ROZO CONFIG
 * API constants are re-exported from @rozoai/intent-common for convenience
 */
export const ROZO_INVOICE_URL = "https://invoice.rozo.ai";

export const DEFAULT_ROZO_APP_ID = "rozoIntentPay";

// --- Stellar ---
export const DEFAULT_STELLAR_RPC_URL = "https://horizon.stellar.org";

// --- Built-in SDK telemetry (anonymous, opt-out via telemetry={false}) ---
export const POSTHOG_KEY = "phc_uWihkYfFeVLE3x62fSVei5h2f2otanBhXg8Jsy7YP8qj";
// export const POSTHOG_KEY =
//   "phc_t2uJYxrPk7gbS4oqdifeAFVt9XavQkzdbKDv9FoVoAyn";
export const POSTHOG_HOST = "https://us.i.posthog.com";

export const STELLAR_INSUFFICIENT_XLM_BASE =
  "Your Stellar account needs a little XLM to pay the network fee. Please add XLM and try again.";

export function getStellarInsufficientXlmMessage(spendable: number, baseFeeXlm: number): string {
  const shortfall = baseFeeXlm - spendable;
  if (spendable < 0) {
    return `Your Stellar account needs ~${Math.abs(spendable).toFixed(4)} XLM to meet the minimum reserve + fee. ${STELLAR_INSUFFICIENT_XLM_BASE}`;
  }
  return `Your Stellar account needs ~${shortfall.toFixed(7)} XLM for the network fee. ${STELLAR_INSUFFICIENT_XLM_BASE}`;
}
