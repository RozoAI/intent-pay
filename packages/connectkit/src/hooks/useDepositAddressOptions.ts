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
  solanaSOL,
} from "@rozoai/intent-common";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PayParams } from "../payment/paymentFsm";
import { normalizeSourceTokenAddress, sourceTokenChainId } from "../utils/token";
import { TrpcClient } from "../utils/trpc";

export interface UseDepositAddressOptionsParams {
  trpc: TrpcClient;
  usdRequired: number | undefined;
  mode: RozoPayOrderMode | undefined;
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
  payParams,
}: UseDepositAddressOptionsParams): UseDepositAddressOptionsReturn {
  const { data, isLoading, error } = useQuery<DepositAddressPaymentOptionMetadata[]>({
    enabled: usdRequired != null && usdRequired > 0 && mode != null,
    queryKey: ["depositAddressOptions", usdRequired, mode, payParams?.appId],
    queryFn: async () => {
      try {
        return await trpc.getDepositAddressOptions.query({
          usdRequired,
          mode,
          appId: payParams?.appId,
        });
      } catch (err) {
        // Fallback to static options on error so the UI never goes blank.
        console.error("Error loading deposit address options:", err);
        return fallbackOptions;
      }
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Memoized configuration for deposit address options
  const filteredOptions = useMemo(() => {
    const options = (data ?? []).map((option) =>
      option.token.symbol === "SOL" &&
      normalizeSourceTokenAddress(option.token.chainId, option.token.token) === solanaSOL.token
        ? { ...option, token: { ...option.token, token: solanaSOL.token } }
        : option,
    );
    if (payParams?.preferredTokens && payParams?.preferredTokens.length > 0) {
      const sourceKey = (chainId: number, address: string) =>
        `${sourceTokenChainId(chainId)}:${normalizeSourceTokenAddress(chainId, address)}`;
      const preferred = new Set(
        payParams.preferredTokens.map((pt) => sourceKey(pt.chainId, pt.token)),
      );
      return options.filter((option) =>
        preferred.has(sourceKey(option.token.chainId, option.token.token)),
      );
    }

    return options;
  }, [data, payParams?.preferredTokens]);

  return {
    options: filteredOptions,
    loading: isLoading,
    error: error
      ? error instanceof Error
        ? error.message
        : "Failed to load deposit address options"
      : null,
  };
}
