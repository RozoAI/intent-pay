/**
 * Cookie-based storage for recently used wallets.
 * V7: Cookie name `rk_recent_wallets`, 30-day expiry, JSON format, max 5 entries.
 * Graceful degradation on cookie rejection (Safari ITP, incognito, etc.).
 */

const COOKIE_NAME = "rk_recent_wallets";
const COOKIE_EXPIRY_DAYS = 30;
const MAX_ENTRIES = 1; // Only store 1 recently used wallet

export type RecentWallet = {
  /** Wallet name (e.g., "MetaMask", "Phantom") */
  name: string;
  /** Connection method: "injected" | "walletconnect" | "solana" | "stellar" */
  method: "injected" | "walletconnect" | "solana" | "stellar";
  /** Wallet icon URL or emoji */
  icon?: string;
  /** Timestamp of last use */
  lastUsed: number;
};

/**
 * Get recently used wallets from cookie.
 * Returns empty array if cookie is missing, invalid, or rejected.
 */
export function getRecentWallets(): RecentWallet[] {
  try {
    if (typeof document === "undefined") return [];

    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));

    if (!cookie) return [];

    const value = decodeURIComponent(cookie.split("=")[1]);
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return [];

    // Validate structure and sort by lastUsed descending
    return parsed
      .filter(
        (w: any) =>
          w &&
          typeof w.name === "string" &&
          typeof w.method === "string" &&
          typeof w.lastUsed === "number"
      )
      .sort((a: RecentWallet, b: RecentWallet) => b.lastUsed - a.lastUsed)
      .slice(0, MAX_ENTRIES);
  } catch {
    // Graceful degradation: cookie rejected or corrupted
    return [];
  }
}

/**
 * Add a wallet to recently used list.
 * Moves existing entry to top, deduplicates, trims to MAX_ENTRIES.
 */
export function addRecentWallet(wallet: Omit<RecentWallet, "lastUsed">): void {
  try {
    if (typeof document === "undefined") return;

    const existing = getRecentWallets();
    const now = Date.now();

    // Remove existing entry for this wallet (by name + method)
    const filtered = existing.filter(
      (w) => !(w.name === wallet.name && w.method === wallet.method)
    );

    // Add new entry at top
    const updated: RecentWallet[] = [
      { ...wallet, lastUsed: now },
      ...filtered,
    ].slice(0, MAX_ENTRIES);

    // Set cookie with 30-day expiry
    const expires = new Date();
    expires.setDate(expires.getDate() + COOKIE_EXPIRY_DAYS);

    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(updated))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
  } catch {
    // Graceful degradation: cookie rejected
  }
}

/**
 * Clear all recently used wallets.
 */
export function clearRecentWallets(): void {
  try {
    if (typeof document === "undefined") return;

    document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  } catch {
    // Graceful degradation
  }
}
