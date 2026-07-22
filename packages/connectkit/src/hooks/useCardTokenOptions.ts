import { useCallback, useMemo } from "react";
import { usePayContext } from "./usePayContext";
import { useTokenOptions } from "./useTokenOptions";
import { WalletPaymentOption } from "@rozoai/intent-common";

/**
 * Token options for RozoPayCard.
 * Delegates to useTokenOptions hook (same as RozoPayButton).
 * V12: Ignores paymentOptions constraints — shows ALL tokens across all networks.
 * Sorted by USD balance descending.
 */
export function useCardTokenOptions(): {
  tokens: CardTokenOption[];
  isLoading: boolean;
  refresh: () => Promise<void>;
} {
  const { paymentState } = usePayContext();

  // Use "all" mode to get tokens from all networks
  const { optionsList, isLoading, refreshOptions } = useTokenOptions("all");

  // Convert Option[] to CardTokenOption[]
  const tokens = useMemo(() => {
    return optionsList.map((option) => {
      // Parse title to extract info
      // Title format: "10.50 USDC on Base" or "0.001 ETH on Base"
      const titleParts = option.title?.split(" on ") ?? [];
      const amountSymbol = titleParts[0] ?? "";
      const chainName = titleParts[1] ?? "Unknown";

      // Extract amount and symbol
      const amountParts = amountSymbol.split(" ");
      const amount = amountParts[0] ?? "0";
      const symbol = amountParts.slice(1).join(" ") ?? "???";

      return {
        id: option.id,
        name: symbol,
        symbol: symbol,
        balance: amount,
        balanceFormatted: amount,
        usdValue: option.sortValue ?? 0,
        chainId: 0, // Not available in Option type
        chainName: chainName,
        network: (chainName.toLowerCase().includes("solana")
          ? "solana"
          : chainName.toLowerCase().includes("stellar")
          ? "stellar"
          : "evm") as "evm" | "solana" | "stellar",
        icon: undefined,
        token: null,
        walletOption: null as any,
        disabled: option.disabled,
        disabledReason: option.subtitle,
        originalOption: option,
      };
    });
  }, [optionsList]);

  const refresh = useCallback(async () => {
    await refreshOptions();
  }, [refreshOptions]);

  return { tokens, isLoading, refresh };
}

/** Token option for RozoPayCard */
export type CardTokenOption = {
  id: string;
  name: string;
  symbol: string;
  balance: string;
  balanceFormatted: string;
  usdValue: number;
  chainId: number;
  chainName: string;
  network: "evm" | "solana" | "stellar";
  icon?: string;
  token: any;
  walletOption: WalletPaymentOption;
  disabled?: boolean;
  disabledReason?: string;
  originalOption: any;
};
