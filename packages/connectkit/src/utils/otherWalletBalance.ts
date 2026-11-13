import { getChainName, WalletPaymentOption } from "@rozoai/intent-common";
import { roundTokenAmount } from "./format";

export type WalletFamily = "evm" | "solana" | "stellar";

/** A connected wallet in a family the token list is NOT showing. */
export type OtherWalletBalance = {
  family: WalletFamily;
  /** "Solana", "Stellar", or the EVM chain name (e.g. "Base"). */
  label: string;
  symbol: string;
  /** Rounded down, display string. */
  balance: string;
  /** Rounded up, display string. Undefined in the deposit flow (no fixed amount). */
  required?: string;
  /** False when the wallet holds the token but below what the payment needs. */
  sufficient: boolean;
};

const WALLET_PAYMENT_OPTIONS: Record<WalletFamily, string> = {
  evm: "Ethereum",
  solana: "Solana",
  stellar: "Stellar",
};

/** Same paymentOptions gate useTokenOptions applies per family. */
function isFamilyAllowed(family: WalletFamily, paymentOptions?: readonly string[]): boolean {
  if (!paymentOptions || paymentOptions.length === 0) return true;
  const walletOptions = Object.values(WALLET_PAYMENT_OPTIONS);
  if (!paymentOptions.some((o) => walletOptions.includes(o))) return true;
  return paymentOptions.includes(WALLET_PAYMENT_OPTIONS[family]);
}

/**
 * Connected wallets of other families whose balances feed
 * getOtherWalletBalances, i.e. the ones "Refresh balance" must also refetch
 * (the token list only refreshes its own mode).
 */
export function getOtherWalletFamilies({
  mode,
  connected,
  paymentOptions,
}: {
  mode: WalletFamily | "all";
  connected: Record<WalletFamily, boolean>;
  paymentOptions?: readonly string[];
}): WalletFamily[] {
  if (mode === "all") return [];
  return (["evm", "solana", "stellar"] as const).filter(
    (family) => family !== mode && connected[family] && isFamilyAllowed(family, paymentOptions),
  );
}

/** Refresh the listed mode plus every other connected wallet family, in parallel. */
export async function refreshWithOtherWallets(
  refreshCurrent: () => Promise<unknown>,
  otherFamilies: WalletFamily[],
  refreshers: Record<WalletFamily, () => Promise<unknown>>,
): Promise<void> {
  await Promise.all([refreshCurrent(), ...otherFamilies.map((family) => refreshers[family]())]);
}

function summarize(
  family: WalletFamily,
  option: WalletPaymentOption,
  isDepositFlow: boolean,
): OtherWalletBalance {
  const token = option.balance.token;
  return {
    family,
    label:
      family === "solana"
        ? "Solana"
        : family === "stellar"
          ? "Stellar"
          : getChainName(token.chainId),
    symbol: token.symbol,
    balance: roundTokenAmount(option.balance.amount, token, "down"),
    required: isDepositFlow
      ? undefined
      : roundTokenAmount(option.required.amount, option.required.token, "up"),
    sufficient: option.disabledReason == null,
  };
}

/**
 * Balances the payer holds in connected wallets of OTHER families than the
 * token list is showing (e.g. a Solana wallet while the list is EVM-only).
 * Uses the payment options the SDK already fetched; no network calls. Best
 * candidate first: payable before insufficient, then highest USD balance.
 */
export function getOtherWalletBalances({
  mode,
  connected,
  options,
  paymentOptions,
  isDepositFlow,
}: {
  mode: WalletFamily | "all";
  connected: Record<WalletFamily, boolean>;
  options: Record<WalletFamily, WalletPaymentOption[] | null | undefined>;
  paymentOptions?: readonly string[];
  isDepositFlow: boolean;
}): OtherWalletBalance[] {
  const best: { usd: number; summary: OtherWalletBalance }[] = [];
  for (const family of getOtherWalletFamilies({ mode, connected, paymentOptions })) {
    const held = (options[family] ?? []).filter((o) => o.balance.usd > 0);
    if (held.length === 0) continue;
    const pick = [...held].sort(
      (a, b) =>
        (a.disabledReason == null ? 0 : 1) - (b.disabledReason == null ? 0 : 1) ||
        b.balance.usd - a.balance.usd,
    )[0];
    best.push({ usd: pick.balance.usd, summary: summarize(family, pick, isDepositFlow) });
  }
  return best
    .sort(
      (a, b) => (a.summary.sufficient ? 0 : 1) - (b.summary.sufficient ? 0 : 1) || b.usd - a.usd,
    )
    .map((b) => b.summary);
}
