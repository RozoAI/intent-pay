import { rozoSolana, solana, WalletPaymentOption } from "@rozoai/intent-common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PayParams } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";
import {
  createRefreshFunction,
  setupRefreshState,
  shouldSkipRefresh,
} from "./refreshUtils";
import { useSupportedChains } from "./useSupportedChains";

/** Wallet payment options. User picks one. */
export function useSolanaPaymentOptions({
  trpc,
  address,
  usdRequired,
  isDepositFlow,
  payParams,
}: {
  trpc: TrpcClient;
  address: string | undefined;
  usdRequired: number | undefined;
  isDepositFlow: boolean;
  payParams: PayParams | undefined;
}) {
  const [options, setOptions] = useState<WalletPaymentOption[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Track the last executed parameters to prevent duplicate API calls
  const lastExecutedParams = useRef<string | null>(null);

  // Track if we're currently making an API call to prevent concurrent requests
  const isApiCallInProgress = useRef<boolean>(false);

  // Track if we have initial data to prevent clearing options on refresh (prevents flickering)
  const hasInitialData = useRef<boolean>(false);

  const { chains } = useSupportedChains();

  // Get Solana chain IDs from supported chains
  const solanaChainIds = useMemo(() => {
    return new Set(
      chains.filter((c) => c.type === "solana").map((c) => c.chainId)
    );
  }, [chains]);

  const stableAppId = useMemo(() => {
    return payParams?.appId;
  }, [payParams]);

  const memoizedPreferredTokens = useMemo(
    () => payParams?.preferredTokens,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(payParams?.preferredTokens)]
  );

  const filteredOptions = useMemo(() => {
    if (!options) return [];

    const preferredTokens = payParams?.preferredTokens;
    const normalizeAddress = (addr: string) => addr.toLowerCase();

    return options
      .filter((option) => {
        // If preferredTokens is not provided or empty, show all options
        if (!preferredTokens || preferredTokens.length === 0) {
          return true;
        }

        const filteredPreferredTokens = preferredTokens.map((pt) => {
          if (pt.chainId === rozoSolana.chainId) {
            return {
              ...pt,
              chainId: solana.chainId,
            };
          }
          return pt;
        });

        // Filter by matching chainId and token address
        return filteredPreferredTokens.some(
          (pt) =>
            pt.chainId === option.balance.token.chainId &&
            normalizeAddress(pt.token) ===
              normalizeAddress(option.balance.token.token)
        );
      })
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
  }, [options, isDepositFlow, usdRequired, payParams?.preferredTokens]);

  // Shared fetch function for Solana payment options
  const fetchBalances = useCallback(async () => {
    if (address == null || usdRequired == null || stableAppId == null) return;

    // Only clear options if we don't have initial data yet to prevent flickering
    // If we already have options, keep them visible while loading new data
    if (!hasInitialData.current) {
      setOptions(null);
      setIsLoading(true);
    } else {
      // Keep existing options visible, just set loading state
      setIsLoading(true);
    }

    try {
      // Filter preferredTokenAddress to only include Solana chain tokens
      const solanaPreferredTokenAddresses = (memoizedPreferredTokens ?? [])
        .filter((t) => solanaChainIds.has(t.chainId))
        .map((t) => t.token);

      const newOptions = await trpc.getSolanaPaymentOptions.query({
        pubKey: address,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId,
        preferredTokenAddress: solanaPreferredTokenAddresses,
      });
      setOptions(newOptions);
      hasInitialData.current = true;
    } catch (error) {
      console.error(error);
      // Only set empty array if we don't have initial data
      if (!hasInitialData.current) {
        setOptions([]);
      }
    } finally {
      isApiCallInProgress.current = false;
      setIsLoading(false);
    }
  }, [
    address,
    usdRequired,
    isDepositFlow,
    trpc,
    stableAppId,
    memoizedPreferredTokens,
  ]);

  // Create refresh function using shared utility
  const refreshOptions = createRefreshFunction(fetchBalances, {
    lastExecutedParams,
    isApiCallInProgress,
  });

  // Reset hasInitialData when address changes to allow clearing options for new address
  useEffect(() => {
    if (address) {
      hasInitialData.current = false;
    }
  }, [address]);

  // Smart clearing: only clear if we don't have data for this address
  useEffect(() => {
    if (address && !options) {
      // Only set loading if we don't have options yet
      setIsLoading(true);
    }
  }, [address, options]);

  useEffect(() => {
    if (address == null || usdRequired == null || stableAppId == null) return;

    const fullParamsKey = JSON.stringify({
      address,
      usdRequired,
      isDepositFlow,
      stableAppId,
      memoizedPreferredTokens,
    });

    // Skip if we've already executed with these exact parameters
    if (
      shouldSkipRefresh(fullParamsKey, {
        lastExecutedParams,
        isApiCallInProgress,
      })
    ) {
      return;
    }

    // Set up refresh state
    setupRefreshState(fullParamsKey, {
      lastExecutedParams,
      isApiCallInProgress,
    });
  }, [
    address,
    usdRequired,
    isDepositFlow,
    stableAppId,
    memoizedPreferredTokens,
  ]);

  // Initial fetch when hook mounts with valid parameters or when key parameters change
  useEffect(() => {
    if (address != null && usdRequired != null && stableAppId != null) {
      refreshOptions();
    }
    // refreshOptions is stable (created from fetchBalances which only changes when dependencies change)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, usdRequired, stableAppId, memoizedPreferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions,
  };
}
