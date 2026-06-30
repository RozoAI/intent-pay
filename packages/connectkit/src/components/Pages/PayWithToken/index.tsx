import {
  FeeResponseData,
  FeeType,
  getCanonicalDestination,
  getChainExplorerTxUrl,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ROUTES } from "../../../constants/routes";
import { useContactSupport } from "../../../hooks/useContactSupport";
import { usePayContext } from "../../../hooks/usePayContext";
import { useRozoPay } from "../../../hooks/useRozoPay";
import { ROZO_EVENTS } from "../../../lib/analytics/events";
import { useAnalytics } from "../../../provider/AnalyticsProvider";
import { getCachedFee, resolveOrderAppId } from "../../../utils/feeCache";
import Button from "../../Common/Button";
import {
  Link,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";
import PaymentBreakdown from "../../Common/PaymentBreakdown";
import TokenLogoSpinner from "../../Spinners/TokenLogoSpinner";

enum PayState {
  RequestingPayment = "Waiting For Payment",
  PreparingTransaction = "Preparing Transaction",
  RequestCancelled = "Payment Cancelled",
  RequestSuccessful = "Payment Successful",
  RequestFailed = "Payment Failed",
}

const PayWithToken: React.FC = () => {
  const walletChainId = useChainId();
  const { triggerResize, paymentState, setRoute, log } = usePayContext();
  const {
    payWithToken,
    setSenderAddress,
    selectedTokenOption,
    walletPaymentOptions,
  } = paymentState;
  const { switchChainAsync } = useSwitchChain();
  const { address } = useAccount();
  const {
    store,
    setPaymentUnpaid,
    rozoPaymentId,
    order,
    paymentState: rozoPaymentState,
  } = useRozoPay();
  const handleContactClick = useContactSupport();

  const { capture } = useAnalytics();
  const [payState, setPayStateInner] = useState<PayState>(
    PayState.RequestingPayment,
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [feeData, setFeeData] = useState<FeeResponseData | null>(null);
  const [feeLoading, setFeeLoading] = useState(true);

  useEffect(() => {
    if (rozoPaymentState === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [rozoPaymentState]);

  const setPayState = (state: PayState) => {
    if (state === payState) return;
    setPayStateInner(state);
    log(`[PayWithToken] payState: ${state}`);
    // (trpc as TrpcClient).nav.mutate({
    //   action: "pay-with-token-state",
    //   data: { state },
    // });
  };

  const switchChainErrorRef = useRef<string | null>(null);

  const trySwitchingChain = async (
    option: WalletPaymentOption,
    forceSwitch: boolean = false,
  ): Promise<boolean> => {
    if (walletChainId !== option.required.token.chainId || forceSwitch) {
      const resultChain = await (async () => {
        try {
          return await switchChainAsync({
            chainId: option.required.token.chainId,
          });
        } catch (e) {
          const message = (e as Error)?.message ?? "switch_chain_failed";
          console.error("Failed to switch chain", e);
          switchChainErrorRef.current = message;
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: rozoPaymentId ?? order?.externalId,
            error_message: message,
            source_chain: option.required.token.chainId,
          });
          return null;
        }
      })();

      if (resultChain?.id !== option.required.token.chainId) {
        return false;
      }
    }

    return true;
  };

  const handleTransfer = useCallback(
    async (option: WalletPaymentOption) => {
      if (!order) {
        throw new Error("Order not initialized");
      }

      capture(ROZO_EVENTS.PAYMENT_CONFIRMED, {
        payment_id: rozoPaymentId ?? order?.externalId,
        source_chain: option.required.token.chainId,
        token_symbol: option.required.token.symbol,
        amount:
          paymentState.payParams?.toUnits != null
            ? String(paymentState.payParams.toUnits)
            : order?.destFinalCallTokenAmount?.usd != null
              ? String(order.destFinalCallTokenAmount.usd)
              : undefined,
      });
      // Switch chain if necessary
      setPayState(PayState.PreparingTransaction);
      const switchChain = await trySwitchingChain(option);

      if (!switchChain) {
        console.error("Switching chain failed");
        setFeeLoading(false);
        setRoute(ROUTES.ERROR, {
          error: switchChainErrorRef.current ?? "switch_chain_failed",
        });
        return;
      }

      try {
        setPayState(PayState.RequestingPayment);
        const currentRozoPaymentId = rozoPaymentId ?? order?.externalId;
        // Only set unpaid if state is payment_started (for retry scenarios and cross-chain switches)
        if (currentRozoPaymentId && rozoPaymentState === "payment_started") {
          try {
            await setPaymentUnpaid(currentRozoPaymentId);
          } catch (e) {
            console.error("Failed to set payment unpaid:", e);
            // If already unpaid, continue anyway
          }
        }

        // @NOTE: Fee calculation
        const destToken = order.destFinalCallTokenAmount?.token;
        setFeeLoading(true);
        const feeData = await getCachedFee({
          appId: resolveOrderAppId(order, paymentState.payParams?.appId),
          type: paymentState.payParams?.feeType ?? FeeType.ExactIn,
          sourceChainId: option.required.token.chainId.toString(),
          sourceTokenSymbol: option.required.token.symbol,
          amount: option.required.usd.toString(),
          destChainId: destToken.chainId.toString(),
          destReceiverAddress:
            getCanonicalDestination(order).finalDestinationAddress ??
            paymentState.payParams?.toAddress ??
            "",
          destTokenSymbol: destToken.symbol,
        });
        setFeeLoading(false);

        if (feeData.error) {
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: rozoPaymentId ?? order?.externalId,
            error_message: feeData.error.message,
            source_chain: option.required.token.chainId,
            source_token: option.required.token.symbol,
            dest_chain: destToken.chainId,
            dest_token: destToken.symbol,
          });
          console.error("Fee calculation failed", feeData.error);
          setPayState(PayState.RequestFailed);
          return;
        }

        setFeeData(feeData.data);

        const result = await payWithToken(
          {
            ...option,
            fees: {
              ...option.fees,
              usd:
                feeData.data?.source.fee != null
                  ? Number(feeData.data.source.fee)
                  : option.fees.usd,
            },
          },
          store as any,
        );
        setTxURL(
          getChainExplorerTxUrl(option.required.token.chainId, result.txHash),
        );
        if (result.success) {
          capture(ROZO_EVENTS.PAYMENT_SUBMITTED, {
            payment_id: rozoPaymentId ?? order?.externalId,
            tx_hash: result.txHash,
            source_chain: option.required.token.chainId,
            token_symbol: option.required.token.symbol,
          });
          try {
            sessionStorage.setItem(
              `rozo_submitted_at:${rozoPaymentId ?? order?.externalId}`,
              String(Date.now()),
            );
          } catch {}
          setSenderAddress(address);
          setPayState(PayState.RequestSuccessful);
          setTimeout(() => {
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-token" });
          }, 200);
          // Refresh wallet payment options after 1 second to prevent stale balances
          setTimeout(() => {
            walletPaymentOptions.refreshOptions();
          }, 2000);
        } else {
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: rozoPaymentId ?? order?.externalId,
            error_message: "payment_unsuccessful",
            source_chain: option.required.token.chainId,
          });
          setPayState(PayState.RequestFailed);
        }
      } catch (e: any) {
        if (e?.name === "ConnectorChainMismatchError") {
          // Workaround for Rainbow wallet bug -- user is able to switch chain without
          // the wallet updating the chain ID for wagmi.
          log("Chain mismatch detected, attempting to switch and retry");
          const switchSuccessful = await trySwitchingChain(option, true);
          if (switchSuccessful) {
            try {
              const retryResult = await payWithToken(option, store as any);
              setTxURL(
                getChainExplorerTxUrl(
                  option.required.token.chainId,
                  retryResult.txHash,
                ),
              );
              if (retryResult.success) {
                capture(ROZO_EVENTS.PAYMENT_SUBMITTED, {
                  payment_id: rozoPaymentId ?? order?.externalId,
                  tx_hash: retryResult.txHash,
                  source_chain: option.required.token.chainId,
                  token_symbol: option.required.token.symbol,
                });
                try {
                  sessionStorage.setItem(
                    `rozo_submitted_at:${rozoPaymentId ?? order?.externalId}`,
                    String(Date.now()),
                  );
                } catch {}
                setSenderAddress(address);
                setPayState(PayState.RequestSuccessful);
                setTimeout(() => {
                  setRoute(ROUTES.CONFIRMATION, {
                    event: "wait-pay-with-token",
                  });
                }, 200);
                // Refresh wallet payment options after 1 second to prevent stale balances
                setTimeout(() => {
                  walletPaymentOptions.refreshOptions();
                }, 2000);
              } else {
                capture(ROZO_EVENTS.PAYMENT_FAILED, {
                  payment_id: rozoPaymentId ?? order?.externalId,
                  error_message: "payment_unsuccessful_after_chain_switch",
                  source_chain: option.required.token.chainId,
                });
                setPayState(PayState.RequestFailed);
              }
              return; // Payment handled after switching chain
            } catch (retryError) {
              console.error(
                "Failed to pay with token after switching chain",
                retryError,
              );
              throw retryError;
            }
          }
        }
        capture(ROZO_EVENTS.PAYMENT_FAILED, {
          payment_id: rozoPaymentId ?? order?.externalId,
          error_message: (e as Error)?.message ?? "unknown_error",
          source_chain: option.required.token.chainId,
        });
        setPayState(PayState.RequestCancelled);
        console.error("Failed to pay with token", e);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletPaymentOptions, rozoPaymentId, order, rozoPaymentState],
  );

  useEffect(() => {
    if (!selectedTokenOption) return;

    const transferTimeout = setTimeout(() => {
      handleTransfer(selectedTokenOption);
    }, 100);
    return () => {
      clearTimeout(transferTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokenOption]);

  useEffect(() => {
    triggerResize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payState]);

  if (selectedTokenOption == null) {
    return <PageContent></PageContent>;
  }

  return (
    <PageContent>
      <TokenLogoSpinner token={selectedTokenOption.required.token} />
      <ModalContent style={{ paddingBottom: 0 }} $preserveDisplay={true}>
        {txURL ? (
          <ModalH1>
            <Link href={txURL} target="_blank" rel="noopener noreferrer">
              {payState}
            </Link>
          </ModalH1>
        ) : (
          <ModalH1>{payState}</ModalH1>
        )}
        <PaymentBreakdown
          paymentOption={{
            ...selectedTokenOption,
            fees: {
              ...selectedTokenOption.fees,
              usd:
                feeData?.source.fee != null
                  ? Number(feeData.source.fee)
                  : selectedTokenOption.fees.usd,
            },
          }}
          feeData={feeData}
          feeLoading={feeLoading}
        />
        {payState === PayState.RequestCancelled && (
          <Button onClick={() => handleTransfer(selectedTokenOption)}>
            Retry Payment
          </Button>
        )}
        {payState === PayState.RequestFailed && (
          <Button onClick={handleContactClick}>Contact Support</Button>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithToken;
