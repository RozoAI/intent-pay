import {
  rozoStellar,
  TokenSymbol,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PayParams, PreferredTokenSymbol } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";
import {
  createRefreshFunction,
  setupRefreshState,
  shouldSkipRefresh,
} from "./refreshUtils";
import { useSupportedChains } from "./useSupportedChains";

/** Wallet payment options. User picks one. */
export function useStellarPaymentOptions({
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
  const { tokens } = useSupportedChains();

  const [options, setOptions] = useState<WalletPaymentOption[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Track the last executed parameters to prevent duplicate API calls
  const lastExecutedParams = useRef<string | null>(null);

  // Track if we're currently making an API call to prevent concurrent requests
  const isApiCallInProgress = useRef<boolean>(false);

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

    // Get preferred symbols from payParams, default to ["USDC", "USDT"]
    const preferredSymbols = payParams?.preferredSymbol ?? [
      TokenSymbol.USDC,
      TokenSymbol.USDT,
    ];

    // Helper to normalize token addresses for comparison
    const normalizeAddress = (addr: string) => addr.toLowerCase();

    return options
      .filter((option) => {
        const tokenChainId = option.balance.token.chainId;
        const tokenAddress = option.balance.token.token;
        const tokenSymbol = option.balance.token.symbol;

        // First check if token symbol is in preferredSymbols
        if (!preferredSymbols.includes(tokenSymbol as PreferredTokenSymbol)) {
          // Allow EURC if it's explicitly in preferredTokens
          if (tokenSymbol === "EURC") {
            const preferredTokens = payParams?.preferredTokens;
            if (preferredTokens && preferredTokens.length > 0) {
              return preferredTokens.some(
                (pt) =>
                  pt.chain === tokenChainId &&
                  normalizeAddress(pt.address) ===
                    normalizeAddress(tokenAddress)
              );
            }
          }
          return false;
        }

        // Otherwise, check against supported tokens
        return tokens.some(
          (t) =>
            normalizeAddress(t.token) === normalizeAddress(tokenAddress) &&
            t.chainId === rozoStellar.chainId
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
  }, [
    options,
    isDepositFlow,
    usdRequired,
    tokens,
    payParams?.preferredSymbol,
    payParams?.preferredTokens,
  ]);

  // Shared fetch function for Stellar payment options
  const fetchBalances = useCallback(async () => {
    if (address == null || usdRequired == null || stableAppId == null) return;

    setOptions(null);
    setIsLoading(true);

    try {
      const newOptions = await trpc.getStellarPaymentOptions.query({
        stellarAddress: address,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId,
        preferredTokenAddress: memoizedPreferredTokens,
      });
      setOptions(newOptions);
    } catch (error) {
      console.error(error);
      setOptions([]);
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
  }, [address, usdRequired, stableAppId]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions,
  };
}
