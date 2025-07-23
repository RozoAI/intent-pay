import { useMemo } from "react";
import { baseUSDC } from "@rozoai/intent-common";
import { PayParams } from "../payment/paymentFsm";
import { ROZO_STELLAR_ADDRESS } from "../constants/rozoConfig";

/**
 * Return type for the useStellarDestination hook
 */
interface StellarDestinationResult {
  /** The middleware address to use for the transaction */
  readonly destinationAddress: string | undefined;
  /** Whether this is a Stellar payment (Pay In Stellar scenarios) */
  readonly isStellarPayment: boolean;
  /** Pay In Stellar, Pay out Stellar scenario */
  readonly isPayInStellarOutStellar: boolean;
  /** Pay In Stellar, Pay Out Base scenario */
  readonly isPayInStellarOutBase: boolean;
  /** Whether toStellarAddress is provided and not empty */
  readonly hasToStellarAddress: boolean;
  /** Whether the payout destination is Base USDC */
  readonly isPayOutToBase: boolean;
}

/**
 * Hook to determine the correct destination address for Stellar transactions.
 * 
 * Handles Pay In Stellar scenarios:
 * 1. Pay In Stellar, Pay out Stellar - use toStellarAddress
 * 2. Pay In Stellar, Pay Out Base - use ROZO_STELLAR_ADDRESS (when toChain is Base and toStellarAddress is empty)
 * 
 * @param payParams - Payment parameters containing transaction details
 * @returns Object with destination address and payment scenario flags
 */
export function useStellarDestination(payParams?: PayParams): StellarDestinationResult {
  const hasToStellarAddress = useMemo((): boolean => {
    const address = payParams?.toStellarAddress;
    return Boolean(address && address.trim() !== "");
  }, [payParams?.toStellarAddress]);

  const isPayOutToBase = useMemo((): boolean => {
    return payParams?.toChain === baseUSDC.chainId;
  }, [payParams?.toChain]);

  const isPayInStellarOutStellar = useMemo((): boolean => {
    return hasToStellarAddress;
  }, [hasToStellarAddress]);

  const isPayInStellarOutBase = useMemo((): boolean => {
    return isPayOutToBase && !hasToStellarAddress;
  }, [isPayOutToBase, hasToStellarAddress]);

  const isStellarPayment = useMemo((): boolean => {
    return isPayInStellarOutStellar || isPayInStellarOutBase;
  }, [isPayInStellarOutStellar, isPayInStellarOutBase]);

  const destinationAddress = useMemo((): string | undefined => {
    if (isPayInStellarOutStellar && payParams?.toStellarAddress) {
      return payParams.toStellarAddress;
    }
    if (isPayInStellarOutBase) {
      return ROZO_STELLAR_ADDRESS;
    }
    return undefined;
  }, [isPayInStellarOutStellar, isPayInStellarOutBase, payParams?.toStellarAddress]);

  return {
    destinationAddress,
    isStellarPayment,
    isPayInStellarOutStellar,
    isPayInStellarOutBase,
    hasToStellarAddress,
    isPayOutToBase,
  } as const;
}
