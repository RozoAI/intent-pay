import { WalletPaymentOption } from "@rozoai/intent-common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { PayParams } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";
import { useSupportedChains } from "./useSupportedChains";

/**
 * Wallet payment options. User picks one.
 *
 * This hook manages wallet-based payment options by:
 * 1. Fetching available payment options from the API based on user's wallet balance
 * 2. Filtering to only show currently supported chains and tokens
 *
 * CURRENTLY SUPPORTED CHAINS & TOKENS IN WALLET PAYMENT OPTIONS:
 * - Base (Chain ID: 8453) - USDC
 * - Polygon (Chain ID: 137) - USDC
 * - Ethereum (Chain ID: 1) - USDC
 * - BSC (Chain ID: 56) - USDT (when MugglePay app, BSC preferred, or user has BSC USDT balance, even if disabled)
 * - Rozo Solana - USDC (native Solana USDC)
 * - Rozo Stellar - USDC/XLM (native Stellar tokens)
 *
 * Note: The SDK supports many more chains/tokens (see pay-common/src/chain.ts and token.ts)
 * but wallet payment options are currently filtered to the above for optimal user experience.
 */
// SUPPORTED CHAINS: Only these chains are currently active in wallet payment options
export function useWalletPaymentOptions({
  trpc,
  address,
  usdRequired,
  destChainId,
  isDepositFlow,
  payParams,
  log,
}: {
  trpc: TrpcClient;
  address: string | undefined;
  usdRequired: number | undefined;
  destChainId: number | undefined;
  isDepositFlow: boolean;
  payParams: PayParams | undefined;
  log: (msg: string) => void;
}) {
  const [options, setOptions] = useState<WalletPaymentOption[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Track the last executed parameters to prevent duplicate API calls
  const lastExecutedParams = useRef<string | null>(null);

  // Track if we're currently making an API call to prevent concurrent requests
  const isApiCallInProgress = useRef<boolean>(false);

  // Extract appId to avoid payParams object recreation causing re-runs
  const stableAppId = useMemo(() => {
    return payParams?.appId ?? DEFAULT_ROZO_APP_ID;
  }, [payParams?.appId]);

  // Memoize array dependencies to prevent unnecessary re-fetches
  // TODO: this is an ugly way to handle polling/refresh
  // Notice the load-bearing JSON.stringify() to prevent a visible infinite
  // refresh glitch on the SelectMethod screen. Replace this useEffect().
  const memoizedPreferredChains = useMemo(
    () => payParams?.preferredChains,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payParams]
  );
  const memoizedPreferredTokens = useMemo(
    () => payParams?.preferredTokens,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payParams]
  );

  const { chains, tokens } = useSupportedChains();

  const filteredOptions = useMemo(() => {
    if (!options) return [];

    const normalizeAddress = (addr: string) => addr.toLowerCase();

    // Filter out chains/tokens we don't support yet in wallet payment options
    const isSupported = (o: WalletPaymentOption) =>
      chains.some(
        (c) =>
          c.chainId === o.balance.token.chainId &&
          tokens.some((t) => t.token === o.balance.token.token)
      );

    // If preferredTokens is provided and not empty, filter by matching chainId and token address
    const matchesPreferredTokens = (o: WalletPaymentOption) => {
      if (!memoizedPreferredTokens || memoizedPreferredTokens.length === 0) {
        return true; // Show all if no memoizedPreferredTokens specified
      }
      return memoizedPreferredTokens.some(
        (pt) =>
          pt.chainId === o.balance.token.chainId &&
          normalizeAddress(pt.token) === normalizeAddress(o.balance.token.token)
      );
    };

    return options
      .filter(isSupported)
      .filter(matchesPreferredTokens)
      .map((item) => {
        const usd = isDepositFlow ? 0 : usdRequired || 0;

        const value: WalletPaymentOption = {
          ...item,
          required: {
            ...item.required,
            usd,
          },
        };

        // Set `disabledReason` manually (based on current usdRequired state, not API Request)
        if (item.balance.usd < usd) {
          value.disabledReason = `Balance too low: $${item.balance.usd.toFixed(
            2
          )}`;
        }

        return value;
      }) as WalletPaymentOption[];
  }, [
    options,
    chains,
    tokens,
    isDepositFlow,
    usdRequired,
    memoizedPreferredTokens,
  ]);

  // Smart clearing: only clear if we don't have data for this address
  useEffect(() => {
    if (address && !options) {
      // Only set loading if we don't have options yet
      setIsLoading(true);
    }
  }, [address, options]);

  // Shared fetch function for wallet payment options
  const fetchBalances = useCallback(async () => {
    if (
      address == null ||
      usdRequired == null ||
      destChainId == null ||
      stableAppId == null
    )
      return;

    setOptions(null);
    setIsLoading(true);

    try {
      const newOptions = await trpc.getWalletPaymentOptions.query({
        payerAddress: address,
        usdRequired: isDepositFlow ? undefined : usdRequired,
        destChainId,
        preferredChains: memoizedPreferredChains,
        // preferredTokenAddress: (memoizedPreferredTokens ?? [])?.map(
        //   (t) => t.token
        // ),
        appId: stableAppId,
      });

      setOptions(newOptions);
    } catch (error) {
      console.error(error);
      setOptions([]);
    } finally {
      isApiCallInProgress.current = false;
      setIsLoading(false);
    }
  }, [
    trpc,
    address,
    usdRequired,
    destChainId,
    isDepositFlow,
    memoizedPreferredChains,
    memoizedPreferredTokens,
    stableAppId,
  ]);

  // // Create refresh function using shared utility
  // const refreshOptions = createRefreshFunction(fetchBalances, {
  //   lastExecutedParams,
  //   isApiCallInProgress,
  // });

  // Initial fetch when hook mounts with valid parameters or when key parameters change
  useEffect(() => {
    if (
      address != null &&
      usdRequired != null &&
      destChainId != null &&
      stableAppId != null
    ) {
      fetchBalances();
    }
  }, [address, usdRequired, destChainId, stableAppId]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions: fetchBalances,
  };
}
