import { getKnownToken, normalizeTokenAddress, WalletPaymentOption } from "@rozoai/intent-common";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { PayParams } from "../payment/paymentFsm";
import { TrpcClient } from "../utils/trpc";
import { formatTokenAmount } from "../utils/format";
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
  log: _log,
}: {
  trpc: TrpcClient;
  address: string | undefined;
  usdRequired: number | undefined;
  destChainId: number | undefined;
  isDepositFlow: boolean;
  payParams: PayParams | undefined;
  log: (msg: string) => void;
}) {
  // Fetch under the caller's appId, or the shared DEFAULT_ROZO_APP_ID when
  // none was passed — same fallback as paymentEffects and createPaymentPayload,
  // so balances are visible for every integration regardless of appId config.
  const stableAppId = useMemo(() => {
    return payParams?.appId ?? DEFAULT_ROZO_APP_ID;
  }, [payParams?.appId]);

  const memoizedPreferredChains = useMemo(
    () => payParams?.preferredChains,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(payParams?.preferredChains)],
  );
  const memoizedPreferredTokens = useMemo(
    () => payParams?.preferredTokens,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(payParams?.preferredTokens)],
  );

  const { chains, tokens } = useSupportedChains();

  const evmChainIds = useMemo(
    () => new Set(chains.filter((c) => c.type === "evm").map((c) => c.chainId)),
    [chains],
  );

  const { data, isLoading, refetch } = useQuery<WalletPaymentOption[] | null>({
    enabled:
      address != null &&
      usdRequired != null &&
      destChainId != null,
    queryKey: [
      "walletPaymentOptions",
      address,
      usdRequired,
      destChainId,
      isDepositFlow,
      stableAppId,
      memoizedPreferredChains,
      memoizedPreferredTokens,
    ],
    queryFn: () => {
      // Source of truth for Intent API calls: chain + token pairing.
      const evmPreferredTokens = (memoizedPreferredTokens ?? [])
        .filter((t) => evmChainIds.has(t.chainId))
        .map((t) => ({ chain: t.chainId, address: t.token }));
      // Backward-compat for local proxy implementations that still read this field.
      const evmPreferredTokenAddresses = evmPreferredTokens.map((t) => t.address);

      return trpc.getWalletPaymentOptions.query({
        payerAddress: address!,
        usdRequired: isDepositFlow ? undefined : usdRequired,
        destChainId: destChainId!,
        preferredChains: memoizedPreferredChains,
        preferredTokens: evmPreferredTokens,
        preferredTokenAddress: evmPreferredTokenAddresses,
        appId: stableAppId,
      });
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const filteredOptions = useMemo(() => {
    if (!data) return [];

    const isSupported = (o: WalletPaymentOption) =>
      chains.some(
        (c) =>
          c.chainId === o.balance.token.chainId &&
          tokens.some((t) => t.token === o.balance.token.token),
      );

    const matchesPreferredTokens = (o: WalletPaymentOption) => {
      if (!memoizedPreferredTokens || memoizedPreferredTokens.length === 0) {
        return true;
      }
      return memoizedPreferredTokens.some(
        (pt) =>
          pt.chainId === o.balance.token.chainId &&
          normalizeTokenAddress(pt.chainId, pt.token) ===
            normalizeTokenAddress(o.balance.token.chainId, o.balance.token.token),
      );
    };

    return data
      .filter(isSupported)
      .filter(matchesPreferredTokens)
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
          value.disabledReason = `Balance too low: ${formatTokenAmount(item.balance.usd, 6)} ${destinationFiatISO}`;
        }
        return value;
      }) as WalletPaymentOption[];
  }, [data, chains, tokens, isDepositFlow, usdRequired, memoizedPreferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions: refetch,
  };
}
