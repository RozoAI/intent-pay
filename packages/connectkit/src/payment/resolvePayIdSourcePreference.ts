import {
  rozoSolana,
  rozoStellar,
  solana,
  stellar,
  Token,
  TokenSymbol,
} from "@rozoai/intent-common";
import { derivePayIdPreferredTokens } from "./createPaymentPayload";

/** Button-level source preferences that may narrow the payId-mode token list. */
export interface ButtonSourcePreference {
  preferredSymbol?: TokenSymbol[];
  preferredTokens?: Token[];
  preferredChains?: number[];
}

export interface ResolvedPayIdSourcePreference {
  preferredSymbol: TokenSymbol[];
  preferredTokens: Token[] | undefined;
  preferredChains: number[] | undefined;
}

/**
 * True when the button narrows the destination-derived source set, i.e. there
 * is something a payer-facing "show all coins" action could relax.
 */
export function hasRelaxableSourcePreference(buttonProps?: ButtonSourcePreference): boolean {
  return Boolean(
    (buttonProps?.preferredChains && buttonProps.preferredChains.length > 0) ||
      (buttonProps?.preferredSymbol && buttonProps.preferredSymbol.length > 0) ||
      (buttonProps?.preferredTokens && buttonProps.preferredTokens.length > 0),
  );
}

/**
 * Resolve the payId-mode source-token filter.
 *
 * The floor is always derived from the order's destination token symbol
 * (EURC → EURC only, otherwise USD stablecoins + natives). The button's own
 * preferredSymbol / preferredTokens / preferredChains may narrow it. When
 * `relaxed` is true the button-level narrowing is dropped and only the
 * destination-derived floor remains. Merchant paymentOptions are enforced
 * elsewhere and are not touched here.
 */
export function resolvePayIdSourcePreference(
  destSymbol: string,
  buttonProps: ButtonSourcePreference | undefined,
  relaxed: boolean,
): ResolvedPayIdSourcePreference {
  const button = relaxed ? undefined : buttonProps;
  const derived = derivePayIdPreferredTokens(destSymbol, button?.preferredSymbol);
  let preferredTokens = button?.preferredTokens ?? derived.preferredTokens;
  const preferredChains = button?.preferredChains;

  // Narrow to the requested chains when given. Intersect rather than replace
  // outright so an unsupported/mistyped chain ID can't silently empty the
  // token list: falls back to the full derived set instead.
  if (preferredChains && preferredChains.length > 0 && preferredTokens) {
    const narrowed = preferredTokens.filter((t) => {
      const chainIds = [t.chainId];
      if (t.chainId === solana.chainId) chainIds.push(rozoSolana.chainId);
      if (t.chainId === stellar.chainId) chainIds.push(rozoStellar.chainId);
      return chainIds.some((id) => preferredChains.includes(id));
    });
    if (narrowed.length > 0) preferredTokens = narrowed;
  }

  return { preferredSymbol: derived.preferredSymbol, preferredTokens, preferredChains };
}
