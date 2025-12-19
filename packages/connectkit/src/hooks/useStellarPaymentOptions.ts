import { rozoStellar, WalletPaymentOption } from "@rozoai/intent-common";
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
  const { chains, tokens } = useSupportedChains();

  // Get Stellar chain IDs from supported chains
  const stellarChainIds = useMemo(() => {
    return new Set(
      chains.filter((c) => c.type === "stellar").map((c) => c.chainId)
    );
  }, [chains]);

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

    const preferredTokens = payParams?.preferredTokens;
    // Helper to normalize token addresses for comparison
    const normalizeAddress = (addr: string) => addr.toLowerCase();

    return options
      .filter((option) => {
        const tokenChainId = option.balance.token.chainId;
        const tokenAddress = option.balance.token.token;

        // If preferredTokens is provided and not empty, filter by matching chainId and token address
        if (preferredTokens && preferredTokens.length > 0) {
          return preferredTokens.some(
            (pt) =>
              pt.chainId === tokenChainId &&
              normalizeAddress(pt.token) === normalizeAddress(tokenAddress)
          );
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
  }, [options, isDepositFlow, usdRequired, tokens, payParams?.preferredTokens]);

  // Shared fetch function for Stellar payment options
  const fetchBalances = useCallback(async () => {
    if (address == null || usdRequired == null || stableAppId == null) return;

    setOptions(null);
    setIsLoading(true);

    try {
      // Filter preferredTokenAddress to only include Stellar chain tokens
      const stellarPreferredTokenAddresses = (memoizedPreferredTokens ?? [])
        .filter((t) => stellarChainIds.has(t.chainId))
        .map((t) => t.token);

      const newOptions = await trpc.getStellarPaymentOptions.query({
        stellarAddress: address,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId,
        preferredTokenAddress: stellarPreferredTokenAddresses,
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
    address,
    usdRequired,
    isDepositFlow,
    trpc,
    stableAppId,
    memoizedPreferredTokens,
    // stellarChainIds is derived from chains and is stable, so we don't need it in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, usdRequired, stableAppId, memoizedPreferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions,
  };
}
