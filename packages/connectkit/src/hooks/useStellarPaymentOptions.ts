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
import { TrpcClient } from "../utils/trpc";
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

  const stellarChainIds = useMemo(
    () => new Set(chains.filter((c) => c.type === "stellar").map((c) => c.chainId)),
    [chains],
  );

  const stableAppId = useMemo(() => payParams?.appId, [payParams?.appId]);

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

      return trpc.getStellarPaymentOptions.query({
        stellarAddress: address!,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId!,
        preferredTokenAddress: stellarPreferredTokenAddresses,
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
          required: { ...item.required, usd },
        };
        const destinationFiatISO = getKnownToken(
          item.balance.token.chainId,
          item.balance.token.token,
        )?.fiatISO;
        if (item.balance.usd < usd) {
          value.disabledReason = `Balance too low: ${item.balance.usd.toFixed(2)} ${destinationFiatISO}`;
        }
        return value;
      }) as WalletPaymentOption[];
  }, [data, isDepositFlow, usdRequired, tokens, payParams?.preferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions: refetch,
  };
}
