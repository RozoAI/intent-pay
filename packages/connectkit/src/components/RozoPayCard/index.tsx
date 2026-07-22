import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChainById, rozoSolana, rozoStellar } from "@rozoai/intent-common";
import { getAddress } from "viem";
import { usePayContext } from "../../hooks/usePayContext";
import { validateAddressForChain } from "../../types/chainAddress";
import { validatePayoutToken } from "../../utils/validatePayoutToken";
import { RozoPayCardProps, CardState } from "./types";
import { PayParams } from "../../payment/paymentFsm";
import { CardContainer, CardHeader, CardBody, CardFooter } from "./styles";
import { SelectMethod } from "./SelectMethod";
import { SelectToken } from "./SelectToken";
import { Confirmation } from "./Confirmation";
import { Completed } from "./Completed";
import { CardTokenOption } from "../../hooks/useCardTokenOptions";

/**
 * RozoPayCard — inline payment card component.
 * Embeds the Rozo checkout flow directly in the page layout.
 * No modal, no redirect. Two-panel layout.
 *
 * MUST be rendered inside RozoPayProvider.
 */
export function RozoPayCard(props: RozoPayCardProps): JSX.Element {
  const context = usePayContext();

  // V11: Throw if context is missing
  if (!context) {
    throw new Error(
      "[RozoPayCard] Must be rendered inside <RozoPayProvider>. " +
      "Wrap your app with RozoPayProvider before using RozoPayCard."
    );
  }

  const { paymentState } = context;
  const [cardState, setCardState] = useState<CardState>("loading");
  const [selectedWallet, setSelectedWallet] = useState<{
    id: string;
    name: string;
    method: string;
  } | null>(null);
  const [selectedToken, setSelectedToken] = useState<CardTokenOption | null>(null);

  // Compute payId or payParams from props (same as RozoPayButton)
  const { payParams, payId } = useMemo(() => {
    // Handle payId mode
    if ("payId" in props) {
      return { payParams: null, payId: props.payId };
    }

    // Handle appId mode
    if ("appId" in props) {
      const chain = getChainById(props.toChain);
      if (!chain) {
        return { payParams: null, payId: null };
      }

      const isEvm = chain.type === "evm";
      const {
        appId,
        toChain,
        toAddress,
        toToken,
        toUnits,
        intent,
        paymentOptions,
        preferredChains,
        preferredTokens,
        preferredSymbol,
        feeType,
        externalId,
        metadata,
        receiverMemo,
      } = props;

      const commonParams = {
        appId,
        toChain,
        toToken,
        toUnits,
        intent,
        paymentOptions,
        preferredChains,
        preferredTokens,
        preferredSymbol,
        evmChains: undefined,
        externalId,
        metadata,
        feeType,
        receiverMemo,
      };

      if (isEvm) {
        return {
          payParams: {
            ...commonParams,
            toAddress,
            toCallData: undefined,
            refundAddress: undefined,
          } as PayParams,
          payId: null,
        };
      } else {
        const isSolana = rozoSolana.chainId === toChain;
        const isStellar = rozoStellar.chainId === toChain;

        return {
          payParams: {
            ...commonParams,
            toAddress: getAddress("0x0000000000000000000000000000000000000000"),
            toSolanaAddress: isSolana ? toAddress : undefined,
            toStellarAddress: isStellar ? toAddress : undefined,
          } as PayParams,
          payId: null,
        };
      }
    }

    return { payParams: null, payId: null };
  }, [props, JSON.stringify(props)]);

  // Track previous values to prevent unnecessary API calls
  const prevPayIdRef = useRef<string | null>(null);
  const prevPayParamsRef = useRef<string | null>(null);

  // Handle payId changes
  useEffect(() => {
    if (payId == null) return;
    if (payId === prevPayIdRef.current) return;
    prevPayIdRef.current = payId;
    prevPayParamsRef.current = null;
    paymentState.setPayId(payId);
  }, [payId]);

  // Handle payParams changes
  const payParamsJson = payParams ? JSON.stringify(payParams) : null;
  useEffect(() => {
    if (payParams == null) return;
    if (payParamsJson === prevPayParamsRef.current) return;
    prevPayParamsRef.current = payParamsJson;
    prevPayIdRef.current = null;
    paymentState.setPayParams(payParams);
  }, [payParamsJson]);

  // Validate address format
  useEffect(() => {
    if ("appId" in props && props.toAddress) {
      const isValid = validateAddressForChain(props.toChain, props.toAddress);
      if (!isValid) {
        const chain = getChainById(props.toChain);
        if (chain) {
          console.error(
            `[RozoPayCard] Invalid address format for ${chain.name} (chain ${props.toChain}).`
          );
        }
      }
    }
  }, [props]);

  // Validate chain and token support
  useEffect(() => {
    if ("appId" in props && props.toChain && props.toToken) {
      const validationError = validatePayoutToken(props.toChain, props.toToken);
      if (validationError) {
        console.error(`[RozoPayCard] Validation error: ${validationError.message}`);
      }
    }
  }, [props]);

  // Transition to select_method once payment state is ready
  useEffect(() => {
    if (cardState !== "loading") return;
    if (payId || payParams) {
      const timer = setTimeout(() => {
        setCardState("select_method");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [cardState, payId, payParams]);

  const handleWalletSelect = useCallback(
    (wallet: { id: string; name: string; method: string }) => {
      setSelectedWallet(wallet);
      setCardState("select_token");
    },
    []
  );

  const handleTokenSelect = useCallback(
    (token: CardTokenOption) => {
      setSelectedToken(token);
      setCardState("confirmation");
    },
    []
  );

  const handleConfirm = useCallback(() => {
    setCardState("completed");
  }, []);

  const handlePayAgain = useCallback(() => {
    setSelectedWallet(null);
    setSelectedToken(null);
    setCardState("select_method");
  }, []);

  const handleBackToMethod = useCallback(() => {
    setSelectedWallet(null);
    setCardState("select_method");
  }, []);

  const handleBackToToken = useCallback(() => {
    setSelectedToken(null);
    setCardState("select_token");
  }, []);

  // Render based on card state
  const renderContent = () => {
    switch (cardState) {
      case "loading":
        return (
          <>
            <CardHeader>Loading...</CardHeader>
            <CardBody>
              <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center" }}>
                Loading payment details...
              </div>
            </CardBody>
          </>
        );
      case "select_method":
        return (
          <>
            <CardHeader>Pay {payId ?? ("appId" in props ? props.appId : "")}</CardHeader>
            <CardBody>
              <SelectMethod onWalletSelect={handleWalletSelect} />
            </CardBody>
          </>
        );
      case "select_token":
        return (
          <>
            <CardHeader>Select Token</CardHeader>
            <CardBody>
              <SelectToken
                selectedWallet={selectedWallet}
                onTokenSelect={handleTokenSelect}
                onBack={handleBackToMethod}
              />
            </CardBody>
          </>
        );
      case "confirmation":
        return (
          <>
            <CardHeader>Confirm Payment</CardHeader>
            <CardBody>
              <Confirmation
                selectedWallet={selectedWallet}
                selectedToken={selectedToken}
                onBack={handleBackToToken}
                onConfirm={handleConfirm}
                onError={(error) => setCardState("error")}
              />
            </CardBody>
          </>
        );
      case "completed":
        return (
          <>
            <CardHeader>Payment Complete</CardHeader>
            <CardBody>
              <Completed
                selectedWallet={selectedWallet}
                selectedToken={selectedToken}
                onPayAgain={handlePayAgain}
              />
            </CardBody>
          </>
        );
      case "error":
        return (
          <>
            <CardHeader>Error</CardHeader>
            <CardBody>
              <div style={{ gridColumn: "1 / -1", padding: 40, textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                  Something went wrong
                </div>
                <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>
                  The payment could not be completed.
                </div>
                <button
                  onClick={handlePayAgain}
                  style={{
                    padding: "12px 24px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  Try Again
                </button>
              </div>
            </CardBody>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <CardContainer
      $width={typeof props.width === "number" ? props.width : undefined}
      $height={typeof props.height === "number" ? props.height : undefined}
      className={props.className}
      style={props.style}
    >
      {renderContent()}
      <CardFooter>
        <span>Powered by Rozo</span>
        <button onClick={() => window.Intercom?.("show")}>? Help</button>
      </CardFooter>
    </CardContainer>
  );
}

RozoPayCard.displayName = "RozoPayCard";
