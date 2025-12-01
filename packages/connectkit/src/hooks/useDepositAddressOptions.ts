import {
  base,
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
import { TrpcClient } from "../utils/trpc";

export interface UseDepositAddressOptionsParams {
  trpc: TrpcClient;
  usdRequired: number | undefined;
  mode: RozoPayOrderMode | undefined;
  appId?: string;
}

export interface UseDepositAddressOptionsReturn {
  options: DepositAddressPaymentOptionMetadata[];
  loading: boolean;
  error: string | null;
}

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
}: UseDepositAddressOptionsParams): UseDepositAddressOptionsReturn {
  const [options, setOptions] = useState<DepositAddressPaymentOptionMetadata[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized configuration for deposit address options
  const depositAddressConfig = useMemo(
    () => [
      // Ethereum Mainnet (USDT, USDC)
      {
        id: DepositAddressPaymentOptions.ETHEREUM_USDT,
        logoURI: ethereumUSDT.logoURI,
        minimumUsd: 1,
        chainId: ethereum.chainId,
        token: ethereumUSDT,
      },
      {
        id: DepositAddressPaymentOptions.ETHEREUM_USDC,
        logoURI: ethereumUSDC.logoURI,
        minimumUsd: 1,
        chainId: ethereum.chainId,
        token: ethereumUSDC,
      },
      // Base (USDC)
      {
        id: DepositAddressPaymentOptions.BASE_USDC,
        logoURI: baseUSDC.logoURI,
        minimumUsd: 0.1,
        chainId: base.chainId,
        token: baseUSDC,
      },
      // Solana (USDT, USDC)
      {
        id: DepositAddressPaymentOptions.SOLANA_USDT,
        logoURI: rozoSolanaUSDT.logoURI,
        minimumUsd: 0.1,
        chainId: rozoSolanaUSDT.chainId,
        token: rozoSolanaUSDT,
      },
      {
        id: DepositAddressPaymentOptions.SOLANA_USDC,
        logoURI: rozoSolanaUSDC.logoURI,
        minimumUsd: 0.1,
        chainId: rozoSolanaUSDC.chainId,
        token: rozoSolanaUSDC,
      },
    ],
    [usdRequired]
  );

  // Memoized refresh function to prevent unnecessary re-renders
  const refreshDepositAddressOptions = useCallback(
    async (usd: number, mode: RozoPayOrderMode) => {
      setLoading(true);
      setError(null);

      try {
        // TODO: Uncomment when API endpoint is ready
        // const apiOptions = await trpc.getDepositAddressOptions.query({
        //   usdRequired: usd,
        //   mode,
        // });

        // For now, use static configuration
        // Filter options based on minimum USD requirements
        // const filteredOptions = depositAddressConfig.filter(
        //   (option) => usd >= option.minimumUsd
        // );

        setOptions(depositAddressConfig);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to load deposit address options";
        setError(errorMessage);
        console.error("Error loading deposit address options:", err);

        // Fallback to static options on error
        setOptions(depositAddressConfig);
      } finally {
        setLoading(false);
      }
    },
    [depositAddressConfig]
  );

  // Effect to refresh options when dependencies change
  useEffect(() => {
    if (usdRequired != null && mode != null) {
      refreshDepositAddressOptions(usdRequired, mode);
    }
  }, [usdRequired, mode, refreshDepositAddressOptions]);

  return {
    options: depositAddressConfig,
    loading,
    error,
  };
}
