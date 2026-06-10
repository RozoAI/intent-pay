// EVM address: 0x + 40 hex chars
const EVM_ADDRESS_RE = /0x[0-9a-fA-F]{40}/g;
// Solana address: base58, 32–44 chars (not starting with 0x)
const SOLANA_ADDRESS_RE = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
// Stellar address: G + 55 base32 chars
const STELLAR_ADDRESS_RE = /\bG[A-Z2-7]{55}\b/g;
// EVM tx hash: 0x + 64 hex chars
const TX_HASH_RE = /0x[0-9a-fA-F]{64}/g;
// Numeric amounts followed by a currency/token symbol, e.g. "12.5 USDC"
// Requires the suffix so bare numbers (chain ids, timestamps, order ids) pass through.
const AMOUNT_RE = /\b\d+(\.\d+)?\s*(USDC|USDT|ETH|SOL|XLM|BTC|[A-Z]{2,6})\b/g;

/**
 * Strips addresses, tx hashes, and token amounts from a string before
 * sending to analytics. Prevents PII / sensitive financial data leakage.
 */
export function sanitizeForAnalytics(value: string): string {
  return value
    .replace(TX_HASH_RE, "[tx_hash]")
    .replace(EVM_ADDRESS_RE, "[address]")
    .replace(STELLAR_ADDRESS_RE, "[address]")
    .replace(SOLANA_ADDRESS_RE, "[address]")
    .replace(AMOUNT_RE, "[amount]");
}

/**
 * Sanitizes all string values in a properties object recursively.
 * Non-string values pass through unchanged.
 */
export function sanitizeProperties(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(props)) {
    if (typeof val === "string") {
      out[key] = sanitizeForAnalytics(val);
    } else if (val !== null && typeof val === "object" && !Array.isArray(val)) {
      out[key] = sanitizeProperties(val as Record<string, unknown>);
    } else {
      out[key] = val;
    }
  }
  return out;
}
