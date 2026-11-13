import {
  ExternalPaymentOptions,
  rozoSolana,
  rozoStellar,
  solana,
  stellar,
} from "@rozoai/intent-common";

/** Chain family a wallet deeplink should open on. */
export type DeeplinkChainFamily = "evm" | "solana" | "stellar";

const SOLANA_CHAIN_IDS = [solana.chainId, rozoSolana.chainId];
const STELLAR_CHAIN_IDS = [stellar.chainId, rozoStellar.chainId];

/** Maps a chain ID (native or Rozo alias) to its family. Unknown/invalid → undefined. */
export function getDeeplinkChainFamily(
  chainId: number | null | undefined,
): DeeplinkChainFamily | undefined {
  if (chainId == null || !Number.isSafeInteger(chainId) || chainId <= 0) return undefined;
  if (SOLANA_CHAIN_IDS.includes(chainId)) return "solana";
  if (STELLAR_CHAIN_IDS.includes(chainId)) return "stellar";
  return "evm";
}

const PAYMENT_OPTION_FAMILY: Partial<Record<string, DeeplinkChainFamily>> = {
  [ExternalPaymentOptions.Ethereum]: "evm",
  [ExternalPaymentOptions.Solana]: "solana",
  [ExternalPaymentOptions.Stellar]: "stellar",
};

/**
 * The chain family the order is already pinned to, used to open a wallet's
 * in-app browser on the matching chain. Returns undefined when nothing pins a
 * single family, so callers keep their previous default.
 *
 * Precedence: merchant/caller `preferredChains`, then wallet-family
 * `paymentOptions`, then the order's own `preferredChainId` (only when it agrees
 * with the families allowed above).
 */
export function resolveDeeplinkChainFamily({
  preferredChains,
  paymentOptions,
  orderPreferredChainId,
}: {
  preferredChains?: number[] | null;
  paymentOptions?: readonly string[] | null;
  orderPreferredChainId?: number | null;
}): DeeplinkChainFamily | undefined {
  let allowed: Set<DeeplinkChainFamily> | undefined;

  if (preferredChains && preferredChains.length > 0) {
    const families = preferredChains.map(getDeeplinkChainFamily);
    if (families.every((f) => f != null)) {
      allowed = new Set(families as DeeplinkChainFamily[]);
    }
  }

  if (allowed == null && paymentOptions && paymentOptions.length > 0) {
    const families = paymentOptions
      .map((o) => PAYMENT_OPTION_FAMILY[o])
      .filter((f): f is DeeplinkChainFamily => f != null);
    if (families.length > 0) allowed = new Set(families);
  }

  if (allowed != null && allowed.size === 1) return [...allowed][0];

  const orderFamily = getDeeplinkChainFamily(orderPreferredChainId);
  if (orderFamily != null && (allowed == null || allowed.has(orderFamily))) {
    return orderFamily;
  }
  return undefined;
}
