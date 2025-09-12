import {
  base,
  baseUSDC,
  polygon,
  polygonUSDC,
  rozoSolana,
  rozoSolanaUSDC,
  rozoStellar,
  rozoStellarUSDC,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useEffect, useMemo, useState } from "react";
import { TrpcClient } from "../utils/trpc";

/**
 * Wallet payment options. User picks one.
 *
 * This hook manages wallet-based payment options by:
 * 1. Fetching available payment options from the API based on user's wallet balance
 * 2. Filtering to only show currently supported chains and tokens
 *
 * CURRENTLY SUPPORTED CHAINS & TOKENS IN WALLET PAYMENT OPTIONS:
 * - Base (Chain ID: 8453) - USDC (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
 * - Polygon (Chain ID: 137) - USDC (0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174)
 * - Rozo Solana - USDC (native Solana USDC)
 * - Rozo Stellar - USDC/XLM (native Stellar tokens)
 *
 * Note: The SDK supports many more chains/tokens (see pay-common/src/chain.ts and token.ts)
 * but wallet payment options are currently filtered to the above for optimal user experience.
 */
export function useWalletPaymentOptions({
  trpc,
  address,
  usdRequired,
  destChainId,
  preferredChains,
  preferredTokens,
  evmChains,
  isDepositFlow,
  log,
}: {
  trpc: TrpcClient;
  address: string | undefined;
  usdRequired: number | undefined;
  destChainId: number | undefined;
  preferredChains: number[] | undefined;
  preferredTokens: { chain: number; address: string }[] | undefined;
  evmChains: number[] | undefined;
  isDepositFlow: boolean;
  log: (msg: string) => void;
}) {
  const [options, setOptions] = useState<WalletPaymentOption[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Create stable array dependencies that only change when content actually changes
  const stablePreferredChains = useMemo(() => {
    if (!preferredChains || preferredChains.length === 0) return undefined;
    // Sort to ensure consistent comparison
    return [...preferredChains].sort((a, b) => a - b);
  }, [preferredChains]);

  const stablePreferredTokens = useMemo(() => {
    if (!preferredTokens || preferredTokens.length === 0) return undefined;
    // Sort by chain first, then by address for consistent comparison
    return [...preferredTokens].sort((a, b) => {
      if (a.chain !== b.chain) return a.chain - b.chain;
      return a.address.localeCompare(b.address);
    });
  }, [preferredTokens]);

  const stableEvmChains = useMemo(() => {
    if (!evmChains || evmChains.length === 0) return undefined;
    // Sort to ensure consistent comparison
    return [...evmChains].sort((a, b) => a - b);
  }, [evmChains]);

  useEffect(() => {
    const refreshWalletPaymentOptions = async () => {
      if (address == null || usdRequired == null || destChainId == null) return;

      setOptions(null);
      setIsLoading(true);
      try {
        const queryParams: any = {
          payerAddress: address,
          // API expects undefined for deposit flow.
          usdRequired: isDepositFlow ? undefined : usdRequired,
          destChainId,
        };

        // Only include array parameters if they have values
        if (stablePreferredChains) {
          queryParams.preferredChains = stablePreferredChains;
        }
        if (stablePreferredTokens) {
          queryParams.preferredTokens = stablePreferredTokens;
        }
        if (stableEvmChains) {
          queryParams.evmChains = stableEvmChains;
        }

        const newOptions = await trpc.getWalletPaymentOptions.query(
          queryParams
        );

        // SUPPORTED CHAINS: Only these chains are currently active in wallet payment options
        // To add more chains, add them to both arrays below and ensure they're defined in pay-common
        const suppChains = [base, polygon, rozoSolana, rozoStellar];

        // SUPPORTED TOKENS: Only these specific tokens are currently active
        // Each token corresponds to its respective chain above
        const supportedTokens = [
          baseUSDC.token, // Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
          polygonUSDC.token, // Polygon USDC: 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174
          rozoSolanaUSDC.token, // Solana USDC: native Solana token
          rozoStellarUSDC.token, // Stellar USDC: native Stellar token
        ];

        // Filter out chains/tokens we don't support yet in wallet payment options
        // API may return more options, but we only show these filtered ones to users
        const isSupported = (o: WalletPaymentOption) =>
          suppChains.some(
            (c) =>
              c.chainId === o.balance.token.chainId &&
              supportedTokens.includes(o.balance.token.token)
          );
        const filteredOptions = newOptions.filter(isSupported);
        if (filteredOptions.length < newOptions.length) {
          log(
            `[WALLET]: skipping ${
              newOptions.length - filteredOptions.length
            } unsupported-chain balances on ${address}`
          );
        }

        setOptions(filteredOptions);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    if (address != null && usdRequired != null && destChainId != null) {
      refreshWalletPaymentOptions();
    }
  }, [
    address,
    usdRequired,
    destChainId,
    isDepositFlow,
    stablePreferredChains,
    stablePreferredTokens,
    stableEvmChains,
    trpc,
  ]);

  return {
    options,
    isLoading,
  };
}
