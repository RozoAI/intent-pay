import { TokenSymbol, WalletPaymentOption } from "@rozoai/intent-common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PayParams, PreferredTokenSymbol } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";
import {
  createRefreshFunction,
  setupRefreshState,
  shouldSkipRefresh,
} from "./refreshUtils";

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
  const [isLoading, setIsLoading] = useState(false);

  // Track the last executed parameters to prevent duplicate API calls
  const lastExecutedParams = useRef<string | null>(null);

  // Track if we're currently making an API call to prevent concurrent requests
  const isApiCallInProgress = useRef<boolean>(false);

  // Track if we have initial data to prevent clearing options on refresh (prevents flickering)
  const hasInitialData = useRef<boolean>(false);

  const stableAppId = useMemo(() => {
    return payParams?.appId;
  }, [payParams]);

  const filteredOptions = useMemo(() => {
    if (!options) return [];

    // Get preferred symbols from payParams, default to ["USDC", "USDT"]
    const preferredSymbols = payParams?.preferredSymbol ?? [
      TokenSymbol.USDC,
      TokenSymbol.USDT,
    ];

    return options
      .filter((option) => {
        const tokenSymbol = option.balance.token.symbol;

        // Filter by preferredSymbols (default: USDC, USDT)
        return preferredSymbols.includes(tokenSymbol as PreferredTokenSymbol);
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
  }, [options, isDepositFlow, usdRequired, payParams?.preferredSymbol]);

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
      const newOptions = await trpc.getSolanaPaymentOptions.query({
        pubKey: address,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId,
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
  }, [address, usdRequired, isDepositFlow, trpc, stableAppId]);

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
  }, [address, usdRequired, isDepositFlow, stableAppId]);

  // Initial fetch when hook mounts with valid parameters or when key parameters change
  useEffect(() => {
    if (address != null && usdRequired != null && stableAppId != null) {
      refreshOptions();
    }
    // refreshOptions is stable (created from fetchBalances which only changes when dependencies change)
  }, [address, usdRequired, stableAppId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions,
  };
}
