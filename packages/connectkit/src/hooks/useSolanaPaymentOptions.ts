import {
  getKnownToken,
  normalizeTokenAddress,
  rozoSolana,
  solana,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { PayParams } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";
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
  const { chains } = useSupportedChains();

  const solanaChainIds = useMemo(
    () => new Set(chains.filter((c) => c.type === "solana").map((c) => c.chainId)),
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
      "solanaPaymentOptions",
      address,
      usdRequired,
      isDepositFlow,
      stableAppId,
      memoizedPreferredTokens,
    ],
    queryFn: () => {
      const solanaPreferredTokenAddresses = (memoizedPreferredTokens ?? [])
        .filter((t) => solanaChainIds.has(t.chainId))
        .map((t) => t.token);

      return trpc.getSolanaPaymentOptions.query({
        pubKey: address!,
        // API expects undefined for deposit flow.
        usdRequired: isDepositFlow ? undefined : usdRequired,
        appId: stableAppId!,
        preferredTokenAddress: solanaPreferredTokenAddresses,
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
        if (!preferredTokens || preferredTokens.length === 0) return true;

        const filteredPreferredTokens = preferredTokens.map((pt) =>
          pt.chainId === rozoSolana.chainId ? { ...pt, chainId: solana.chainId } : pt,
        );

        return filteredPreferredTokens.some(
          (pt) =>
            pt.chainId === option.balance.token.chainId &&
            normalizeTokenAddress(pt.chainId, pt.token) ===
              normalizeTokenAddress(option.balance.token.chainId, option.balance.token.token),
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
  }, [data, isDepositFlow, usdRequired, payParams?.preferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions: refetch,
  };
}
