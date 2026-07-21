import { getKnownToken, normalizeTokenAddress, WalletPaymentOption } from "@rozoai/intent-common";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { PayParams } from "../payment/paymentFsm";
import { roundTokenAmount } from "../utils/format";
import { TrpcClient } from "../utils/trpc";
import { useSupportedChains } from "./useSupportedChains";
import { isNativeToken } from "../utils/token";

/**
 * Wallet payment options. User picks one.
 *
 * This hook manages wallet-based payment options by:
 * 1. Fetching available payment options from the API based on user's wallet balance
 * 2. Filtering to only show currently supported chains and tokens
 *
 * CURRENTLY SUPPORTED CHAINS & TOKENS IN WALLET PAYMENT OPTIONS:
 * - Base (Chain ID: 8453) - ETH, USDC
 * - Polygon (Chain ID: 137) - POL, USDC
 * - Ethereum (Chain ID: 1) - ETH, USDC
 * - Arbitrum (Chain ID: 42161) - ETH, USDC, USDT
 * - BSC (Chain ID: 56) - BNB, USDC, USDT (when MugglePay app, BSC preferred, or user has BSC USDT balance, even if disabled)
 * - Solana / Rozo Solana - SOL, USDC (native Solana SOL/USDC)
 * - Stellar / Rozo Stellar - XLM, USDC (native Stellar tokens)
 *
 * Source of truth: this list is derived from `supportedTokens` in
 * pay-common/src/token.ts via `useSupportedChains()` — update that map,
 * not this comment, to change what's actually shown.
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
  // Extract appId to avoid payParams object recreation causing re-runs
  const stableAppId = useMemo(() => {
    return payParams?.appId ?? DEFAULT_ROZO_APP_ID;
  }, [payParams?.appId]);

  // Memoize array dependencies to keep a stable query key
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

  // Get EVM chain IDs from supported chains
  const evmChainIds = useMemo(() => {
    return new Set(chains.filter((c) => c.type === "evm").map((c) => c.chainId));
  }, [chains]);

  const { data, isLoading, refetch } = useQuery<WalletPaymentOption[] | null>({
    enabled:
      address != null &&
      usdRequired != null &&
      destChainId != null &&
      payParams?.appId != null &&
      payParams.appId !== DEFAULT_ROZO_APP_ID,
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
        .map((t) => ({
          chain: t.chainId,
          address: t.token,
        }));
      // Backward-compat for local proxy implementations that still read this field.
      const evmPreferredTokenAddresses = evmPreferredTokens.map((t) => t.address);

      return trpc.getWalletPaymentOptions.query({
        payerAddress: address,
        usdRequired: isDepositFlow ? undefined : usdRequired,
        destChainId,
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

    // Filter out chains/tokens we don't support yet in wallet payment options.
    // Compare token addresses case-insensitively: the supported-tokens registry
    // stores EVM natives lowercase (0xeeee…) while the API returns them EIP-55
    // checksummed (0xEeee…), so a strict `===` would drop native ETH/BNB/POL.
    const isSupported = (o: WalletPaymentOption) =>
      chains.some(
        (c) =>
          c.chainId === o.balance.token.chainId &&
          tokens.some(
            (t) =>
              normalizeTokenAddress(c.chainId, t.token) ===
              normalizeTokenAddress(c.chainId, o.balance.token.token),
          ),
      );

    // If preferredTokens is provided and not empty, filter by matching chainId and token address
    const matchesPreferredTokens = (o: WalletPaymentOption) => {
      if (!memoizedPreferredTokens || memoizedPreferredTokens.length === 0) {
        return true; // Show all if no memoizedPreferredTokens specified
      }
      return memoizedPreferredTokens.some(
        (pt) =>
          pt.chainId === o.balance.token.chainId &&
          normalizeTokenAddress(o.balance.token.chainId, pt.token) ===
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
  }, [data, chains, tokens, isDepositFlow, usdRequired, memoizedPreferredTokens]);

  return {
    options: filteredOptions,
    isLoading,
    refreshOptions: () => refetch().then(() => {}),
  };
}
