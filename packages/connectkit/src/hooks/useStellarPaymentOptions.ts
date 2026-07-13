import {
  getKnownToken,
  normalizeTokenAddress,
  rozoStellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { PayParams } from "../payment/paymentFsm";
import { roundTokenAmount } from "../utils/format";
import { TrpcClient } from "../utils/trpc";
import { useSupportedChains } from "./useSupportedChains";
import { isNativeToken } from "../utils/token";

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
    return new Set(chains.filter((c) => c.type === "stellar").map((c) => c.chainId));
  }, [chains]);

  const stableAppId = useMemo(() => {
    return payParams?.appId;
  }, [payParams]);

  const memoizedPreferredTokens = useMemo(
    () => payParams?.preferredTokens,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(payParams?.preferredTokens)],
  );

  const { data, isLoading, refetch } = useQuery<WalletPaymentOption[] | null>({
    enabled:
      address != null &&
      usdRequired != null &&
      stableAppId != null &&
      stableAppId !== DEFAULT_ROZO_APP_ID,
    queryKey: [
      "stellarPaymentOptions",
      address,
      usdRequired,
      isDepositFlow,
      stableAppId,
      memoizedPreferredTokens,
    ],
    queryFn: () => {
      const stellarPreferredTokenAddresses = (memoizedPreferredTokens ?? [])
        .filter((t) => stellarChainIds.has(t.chainId))
        .map((t) => t.token);

      // Only send preferredTokenAddress when the filter actively restricts
      // tokens (i.e. XLM is absent from the list — e.g. EURC-only or
      // consumer-provided USDC-only list). When XLM is present (default wide
      // list or consumer explicitly including it), omit the filter so the
      // backend returns all available Stellar tokens. This prevents the
      // default stablecoin-derived preference from hiding native XLM options.
      const isRestrictive =
        stellarPreferredTokenAddresses.length > 0 &&
        !stellarPreferredTokenAddresses.includes("XLM");

      return trpc.getStellarPaymentOptions.query({
        stellarAddress: address,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId,
        preferredTokenAddress: isRestrictive ? stellarPreferredTokenAddresses : undefined,
      });
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredOptions = useMemo(() => {
    if (!data) return [];

    const preferredTokens = payParams?.preferredTokens;

    return data
      .filter((option) => {
        const tokenChainId = option.balance.token.chainId;
        const tokenAddress = option.balance.token.token;

        // If preferredTokens is provided and not empty, filter by matching chainId and token address
        if (preferredTokens && preferredTokens.length > 0) {
          return preferredTokens.some(
            (pt) =>
              pt.chainId === tokenChainId &&
              normalizeTokenAddress(tokenChainId, pt.token) ===
                normalizeTokenAddress(tokenChainId, tokenAddress),
          );
        }

        // Otherwise, check against supported tokens
        return tokens.some(
          (t) =>
            normalizeTokenAddress(t.chainId, t.token) ===
              normalizeTokenAddress(tokenChainId, tokenAddress) &&
            t.chainId === rozoStellar.chainId,
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
        const knownToken = getKnownToken(item.balance.token.chainId, item.balance.token.token);
        const fiatISO = knownToken?.fiatISO ?? item.balance.token.fiatISO;
        const isNative = isNativeToken(item.balance.token.token);

        if (item.balance.usd < usd) {
          if (isNative) {
            value.disabledReason = `Balance too low: ${roundTokenAmount(
              item.balance.amount,
              item.balance.token,
            )} ${item.balance.token.symbol}`;
          } else if (fiatISO) {
            value.disabledReason = `Balance too low: ${item.balance.usd.toFixed(2)} ${fiatISO}`;
          } else {
            value.disabledReason = `Balance too low: ${roundTokenAmount(
              item.balance.amount,
              item.balance.token,
            )} ${item.balance.token.symbol}`;
          }
        }

        return value;
      }) as WalletPaymentOption[];
  }, [data, isDepositFlow, usdRequired, tokens, payParams?.preferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions: () => refetch().then(() => {}),
  };
}
