import {
  base,
  baseEURC,
  baseUSDC,
  DepositAddressPaymentOptionMetadata,
  DepositAddressPaymentOptions,
  ethereum,
  ethereumUSDC,
  ethereumUSDT,
  RozoPayOrderMode,
  rozoSolanaUSDC,
  rozoSolanaUSDT,
} from "@rozoai/intent-common";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PayParams } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";

export interface UseDepositAddressOptionsParams {
  trpc: TrpcClient;
  usdRequired: number | undefined;
  mode: RozoPayOrderMode | undefined;
  appId?: string;
  payParams: PayParams | undefined;
}

export interface UseDepositAddressOptionsReturn {
  options: DepositAddressPaymentOptionMetadata[];
  loading: boolean;
  error: string | null;
}
const fallbackOptions = [
  // Ethereum Mainnet (USDT, USDC)
  {
    id: DepositAddressPaymentOptions.ETHEREUM_USDT,
    logoURI: ethereumUSDT.logoURI,
    minimumUsd: 0.01,
    chainId: ethereum.chainId,
    token: ethereumUSDT,
  },
  {
    id: DepositAddressPaymentOptions.ETHEREUM_USDC,
    logoURI: ethereumUSDC.logoURI,
    minimumUsd: 0.01,
    chainId: ethereum.chainId,
    token: ethereumUSDC,
  },
  // Base (USDC, EURC)
  {
    id: DepositAddressPaymentOptions.BASE_USDC,
    logoURI: baseUSDC.logoURI,
    minimumUsd: 0.01,
    chainId: base.chainId,
    token: baseUSDC,
  },
  {
    id: DepositAddressPaymentOptions.BASE_EURC,
    logoURI: baseEURC.logoURI,
    minimumUsd: 0.01,
    chainId: base.chainId,
    token: baseEURC,
  },
  // Solana (USDT, USDC)
  {
    id: DepositAddressPaymentOptions.SOLANA_USDT,
    logoURI: rozoSolanaUSDT.logoURI,
    minimumUsd: 0.01,
    chainId: rozoSolanaUSDT.chainId,
    token: rozoSolanaUSDT,
  },
  {
    id: DepositAddressPaymentOptions.SOLANA_USDC,
    logoURI: rozoSolanaUSDC.logoURI,
    minimumUsd: 0.01,
    chainId: rozoSolanaUSDC.chainId,
    token: rozoSolanaUSDC,
  },
];

/**
 * Hook for managing deposit address payment options.
 *
 * This hook provides a list of available deposit address options for users
 * to send payments to, including various blockchain networks with their
 * respective minimum USD requirements and logos.
 *
 * Currently supported chains:
 * - Base (Chain ID: 8453) - Primary EVM chain
 * - Polygon (Chain ID: 137) - Secondary EVM chain
 * - Ethereum (Chain ID: 1) - Ethereum mainnet
 * - BSC (Chain ID: 56) - Conditional support for MP app IDs
 */
export function useDepositAddressOptions({
  trpc,
  usdRequired,
  mode,
  appId,
  payParams,
}: UseDepositAddressOptionsParams): UseDepositAddressOptionsReturn {
  const [options, setOptions] = useState<DepositAddressPaymentOptionMetadata[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized configuration for deposit address options
  const filteredOptions = useMemo(() => {
    if (payParams?.preferredTokens && payParams?.preferredTokens.length > 0) {
      return options.filter((option) =>
        payParams?.preferredTokens?.some(
          (pt) => pt.token === option.token.token,
        ),
      );
    }

    return options;
  }, [options, payParams?.preferredTokens]);

  // Memoized refresh function to prevent unnecessary re-renders
  const refreshDepositAddressOptions = useCallback(
    async (usd: number, mode: RozoPayOrderMode) => {
      setLoading(true);
      setError(null);

      try {
        const apiOptions = await trpc.getDepositAddressOptions.query({
          usdRequired: usd,
          mode,
        });

        // For now, use static configuration
        // Filter options based on minimum USD requirements
        // const filteredOptions = depositAddressConfig.filter(
        //   (option) => usd >= option.minimumUsd
        // );

        setOptions(apiOptions);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load deposit address options";
        setError(errorMessage);
        console.error("Error loading deposit address options:", err);

        // Fallback to static options on error
        setOptions(fallbackOptions);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Effect to refresh options when dependencies change
  useEffect(() => {
    if (usdRequired != null && mode != null) {
      refreshDepositAddressOptions(usdRequired, mode);
    }
  }, [usdRequired, mode, refreshDepositAddressOptions]);

  return {
    options: filteredOptions,
    loading,
    error,
  };
}
