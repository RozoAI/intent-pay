import { baseUSDC } from "@rozoai/intent-common";
import { useMemo } from "react";
import { PayParams } from "../payment/paymentFsm";

/**
 * Hook to determine the correct destination address for Stellar transactions
 * Handles both payment scenarios:
 * 1. Pay in Stellar, Pay Out to Base USDC - use toAddress if destination is Base USDC
 * 2. Pay in Base USDC, Pay Out to Stellar - use toStellarAddress
 */
export function useStellarDestination(payParams?: PayParams) {
  /**
   * Case 1: Pay in Base USDC, Pay Out to Stellar (inBaseOutStellar)
   * SDK needs to know toStellarAddress
   */
  const isInBaseOutStellar = useMemo(() => {
    return (
      payParams?.toStellarAddress !== undefined &&
      payParams?.toStellarAddress !== null &&
      payParams?.toStellarAddress !== ""
    );
  }, [payParams?.toStellarAddress]);

  /**
   * Case 2: Pay in Stellar, Pay Out to Base USDC (inStellarOutBase)
   * SDK needs to know toChain
   */
  const isInStellarOutBase = useMemo(() => {
    return payParams?.toChain === baseUSDC.chainId;
  }, [payParams?.toChain]);

  /**
   * Checks if the payment involves Stellar (either as source or destination)
   */
  const isStellarPayment = useMemo(() => {
    return isInBaseOutStellar || isInStellarOutBase;
  }, [isInBaseOutStellar, isInStellarOutBase]);

  /**
   * Determines the correct destination address based on payment direction
   */
  const destinationAddress = useMemo(() => {
    let address: string | undefined = undefined;

    // Case 1: Pay in Stellar, Pay Out to Base USDC - use toAddress if destination is Base USDC
    if (isInStellarOutBase && payParams?.toAddress) {
      address = payParams.toAddress;
    }

    // Case 2: Pay in Base USDC, Pay Out to Stellar - use toStellarAddress
    if (isInBaseOutStellar && payParams?.toStellarAddress) {
      address = payParams.toStellarAddress;
    }

    return address;
  }, [
    isInStellarOutBase,
    isInBaseOutStellar,
    payParams?.toAddress,
    payParams?.toStellarAddress,
  ]);

  return {
    destinationAddress,
    isStellarPayment,
    isInBaseOutStellar,
    isInStellarOutBase,
  };
}
