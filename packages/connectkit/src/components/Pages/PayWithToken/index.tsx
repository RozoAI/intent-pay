import {
  FeeResponseData,
  getCanonicalDestination,
  getChainExplorerTxUrl,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { formatUnits, getAddress } from "viem";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useChainId, useConfig, useSwitchChain } from "wagmi";
import { getBytecode } from "wagmi/actions";
import { ROUTES } from "../../../constants/routes";
import { useContactSupport } from "../../../hooks/useContactSupport";
import { usePayContext } from "../../../hooks/usePayContext";
import { useRozoPay } from "../../../hooks/useRozoPay";
import {
  beginRequestScope,
  isAbortError,
  PAYMENT_REQUEST_SCOPE,
} from "../../../utils/paymentRequestScope";
import { ROZO_EVENTS } from "../../../lib/analytics/events";
import {
  classifyPayerCode,
  classifyWalletFailure,
  shouldPromotePayAnotherWay,
  walletFailureMessage,
  walletFailureTitle,
  type WalletFailure,
} from "../../../payment/walletFailure";
import { resolveChainObject } from "../../../defaultConfig";
import {
  formatWalletNoGasMessage,
  isInsufficientFundsError,
  isInsufficientNativeGasError,
  noGasTelemetry,
} from "../../../payment/erc20GasPrecheck";
import { useAnalytics } from "../../../provider/AnalyticsProvider";
import { buildFeeQuoteParams, getCachedFee } from "../../../utils/feeCache";
import { resolveSourceAmountUnits, resolveWalletSourceBreakdown, type WalletSourceQuoteOrder } from "../../../payment/createPaymentPayload";
import Button from "../../Common/Button";
import {
  Link,
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../Common/Modal/styles";
import PaymentBreakdown from "../../Common/PaymentBreakdown";
import TokenLogoSpinner from "../../Spinners/TokenLogoSpinner";

enum PayState {
  WaitingForConfirmation = "Waiting for Confirmation",
  PreparingTransaction = "Preparing Transaction",
  RequestCancelled = "Payment Cancelled",
  RequestSuccessful = "Payment Successful",
  WaitingForWallet = "Wallet Confirmation Pending",
  RequestFailed = "Payment Failed",
  NetworkFeeNeeded = "Network Fee Needed",
}

const PayWithToken: React.FC = () => {
  const walletChainId = useChainId();
  const { triggerResize, paymentState, setRoute, log } = usePayContext();
  const {
    payWithToken,
    precheckErc20WalletGas,
    setSenderAddress,
    selectedTokenOption,
    walletPaymentOptions,
    pendingPaymentAttemptId,
    tryClaimPaymentAttempt,
    releasePaymentAttempt,
    setWalletPaymentState,
  } = paymentState;
  const { switchChainAsync } = useSwitchChain();
  const { address, connector } = useAccount();
  const wagmiConfig = useConfig();
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
    PayState.PreparingTransaction,
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [feeData, setFeeData] = useState<FeeResponseData | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [noGasMessage, setNoGasMessage] = useState<string | null>(null);
  const [noGasSymbol, setNoGasSymbol] = useState<string | null>(null);
  // Last wallet-send failure and how many in a row for the selected option.
  // Drives the "Pay another way" exit (see payment/walletFailure.ts).
  const [lastFailure, setLastFailure] = useState<WalletFailure | null>(null);
  const failureCountRef = useRef(0);

  useEffect(() => {
    if (rozoPaymentState === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [rozoPaymentState]);

  const setPayState = (state: PayState) => {
    // Compare against the *current* state inside the updater, not the `payState`
    // closed over by render. `handleTransfer` is memoized with a short dep list,
    // so it can hold a `setPayState` from an older render; guarding on that
    // stale value silently dropped real transitions (e.g. NetworkFeeNeeded after
    // a wallet-rejected retry), leaving the UI stuck on "Waiting for
    // Confirmation". React bails out when the updater returns the same value, so
    // returning `prev` keeps the original no-op-on-equal behaviour.
    setPayStateInner((prev) => (prev === state ? prev : state));
    log(`[PayWithToken] payState: ${state}`);
    // (trpc as TrpcClient).nav.mutate({
    //   action: "pay-with-token-state",
    //   data: { state },
    // });
  };

  const switchChainErrorRef = useRef<string | null>(null);
  const transferInFlightRef = useRef(false);
  const autoTransferOrderRef = useRef<string | null>(null);

  const trySwitchingChain = async (option: WalletPaymentOption): Promise<boolean> => {
    if (walletChainId !== option.required.token.chainId) {
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
    async (option: WalletPaymentOption, opts?: { skipGasPrecheck?: boolean }) => {
      if (transferInFlightRef.current) {
        log("[PayWithToken] transfer already in flight");
        return;
      }
      transferInFlightRef.current = true;
      let attemptId: string | undefined;

      // Blocked before the wallet opened: the payer cannot pay the network
      // fee. Not a payment failure; tell them why.
      const showNoGas = (err: unknown): boolean => {
        if (!isInsufficientNativeGasError(err)) return false;
        capture(ROZO_EVENTS.PAYMENT_BLOCKED_NO_GAS, {
          payment_id: rozoPaymentId ?? order?.externalId,
          ...noGasTelemetry(err.shortfall),
        });
        setNoGasMessage(err.message);
        setNoGasSymbol(err.shortfall.nativeSymbol);
        setPayState(PayState.NetworkFeeNeeded);
        return true;
      };

      // The wallet itself rejected the transfer for insufficient native funds.
      // The lenient precheck cannot model the wallet's maxFeePerGas buffer, so
      // this is where that gap surfaces. Same treatment, no exact amounts.
      const showWalletNoGas = (err: unknown): boolean => {
        if (!isInsufficientFundsError(err)) return false;
        const nativeSymbol =
          resolveChainObject(option.required.token.chainId)?.nativeCurrency
            .symbol ?? "gas";
        capture(ROZO_EVENTS.PAYMENT_BLOCKED_NO_GAS, {
          payment_id: rozoPaymentId ?? order?.externalId,
          chain: option.required.token.chainId,
          token: option.required.token.symbol,
          native_symbol: nativeSymbol,
          source: "wallet_error",
        });
        setNoGasMessage(
          formatWalletNoGasMessage(nativeSymbol, option.required.token.symbol),
        );
        setNoGasSymbol(nativeSymbol);
        setPayState(PayState.NetworkFeeNeeded);
        return true;
      };

      try {
        // Read the freshest order straight from the store instead of the React
      // closure snapshot. For payId mode this is the getPayment-derived order
      // loaded by runSetPayIdEffects, so getFee below runs against the latest
      // payment response (correct appId, amount, destination, etc.).
      const currentState = store.getState();
      const currentOrder =
        currentState.type !== "idle" ? currentState.order : undefined;
      if (!currentOrder) {
        throw new Error("Order not initialized");
      }
      attemptId = currentOrder.externalId ?? String(currentOrder.id);
      if (!tryClaimPaymentAttempt(attemptId)) {
        log("[PayWithToken] wallet request already pending");
        capture(ROZO_EVENTS.PAYMENT_WALLET_CONFIRMATION_PENDING, {
          payment_id: currentOrder.externalId,
          source_chain: option.required.token.chainId,
          token_symbol: option.required.token.symbol,
        });
        setPayState(PayState.WaitingForWallet);
        return;
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
      // Native-gas precheck runs BEFORE the chain switch so a payer holding no
      // gas coin never sees a switch/transfer wallet popup. Reads use an
      // explicit chainId, so they do not need the wallet on the target chain.
      if (!opts?.skipGasPrecheck) {
        try {
          await precheckErc20WalletGas(option);
        } catch (precheckError) {
          if (showNoGas(precheckError)) return;
          throw precheckError;
        }
      }

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
        const currentRozoPaymentId =
          rozoPaymentId ?? currentOrder.externalId ?? undefined;
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
        const request = beginRequestScope(PAYMENT_REQUEST_SCOPE);
        const destToken = currentOrder.destFinalCallTokenAmount?.token;
        const destAmountAtomic = currentOrder.destFinalCallTokenAmount?.amount;
        const toUnits = destAmountAtomic && destToken
          ? formatUnits(BigInt(destAmountAtomic), destToken.decimals)
          : option.required.usd.toString();

        // The payment/checkout already quoted this source; its stored breakdown
        // is authoritative. Re-quoting via getFee is redundant and, for native
        // sources, can diverge from the amount the wallet will sign (wallet
        // confirmation reads the payment's source.amount, not getFee).
        let quoteData: FeeResponseData | null =
          resolveWalletSourceBreakdown(
            currentOrder as WalletSourceQuoteOrder,
            option.required.token,
          ) ?? null;

        if (!quoteData) {
          setFeeLoading(true);
          const feeData = await getCachedFee(
            buildFeeQuoteParams({
              order: currentOrder,
              payParams: paymentState.payParams,
              destChainId: destToken.chainId,
              destTokenAddress: destToken.token,
              destAddress:
                getCanonicalDestination(currentOrder).finalDestinationAddress ??
                "",
              sourceChainId: option.required.token.chainId,
              sourceTokenAddress: option.required.token.token,
              toUnits,
              sourceAmountUnits: resolveSourceAmountUnits(option.required),
            }),
            { signal: request.signal },
          );
          setFeeLoading(false);

          if (request.signal.aborted) {
            return;
          }

          if (feeData.error) {
            if (feeData.error.name === "AbortError") {
              return;
            }
            capture(ROZO_EVENTS.PAYMENT_FAILED, {
              payment_id: rozoPaymentId ?? order?.externalId,
              error_message: feeData.error.message,
              source_chain: option.required.token.chainId,
              source_token: option.required.token.symbol,
              dest_chain: destToken.chainId,
              dest_token: destToken.symbol,
            });
            console.error("Fee calculation failed", feeData.error);
            setRoute(ROUTES.ERROR, { error: feeData.error.message });
            return;
          }
          quoteData = feeData.data;
        } else {
          // Stored payment quote: no fetch in flight, so clear any stale spinner.
          setFeeLoading(false);
        }

        setFeeData(quoteData);
        setNoGasMessage(null);
        setPayState(PayState.WaitingForConfirmation);

        const result = await payWithToken(
          {
            ...option,
            fees: {
              ...option.fees,
              usd:
                quoteData?.source.fee != null
                  ? Number(quoteData.source.fee)
                  : option.fees.usd,
            },
          },
          store as any,
          opts,
        );
        const completedState = store.getState();
        const canonicalBreakdown =
          completedState.type !== "idle"
            ? (completedState.order as WalletSourceQuoteOrder).paymentBreakdown
            : undefined;
        if (canonicalBreakdown) setFeeData(canonicalBreakdown);
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
        // Abort = user navigated away (Back / reset). Not a payment failure.
        if (isAbortError(e)) return;

        if (showNoGas(e)) return;
        if (showWalletNoGas(e)) return;

        if (e?.name === "ConnectorChainMismatchError") {
          // Workaround for Rainbow wallet bug -- user is able to switch chain without
          // the wallet updating the chain ID for wagmi.
          log("Chain mismatch detected, attempting to switch and retry");
          const switchSuccessful = await trySwitchingChain(option);
          if (switchSuccessful) {
            try {
              const retryResult = await payWithToken(option, store as any, opts);
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
              if (showNoGas(retryError)) return;
              if (showWalletNoGas(retryError)) return;
              console.error(
                "Failed to pay with token after switching chain",
                retryError,
              );
              throw retryError;
            }
          }
        }
        const failure = classifyWalletFailure(e);
        failureCountRef.current += 1;
        setLastFailure(failure);
        setPayState(PayState.RequestCancelled);
        console.error("Failed to pay with token", e);
        // Label the payer's account type (EOA / EIP-7702 / contract) so a
        // wallet-side failure can be triaged from the event alone. Read after
        // the UI state is set; a failed read is "unknown", never blocking.
        let payerCode: string | null | undefined;
        try {
          payerCode = address
            ? await getBytecode(wagmiConfig, {
                address: getAddress(address),
                chainId: option.required.token.chainId,
              })
            : undefined;
        } catch {
          payerCode = undefined;
        }
        capture(ROZO_EVENTS.PAYMENT_FAILED, {
          payment_id: rozoPaymentId ?? order?.externalId,
          error_message: failure.message,
          source_chain: option.required.token.chainId,
          source_token: option.required.token.symbol,
          failure_kind: failure.kind,
          rpc_error_code: failure.rpcCode,
          consecutive_failures: failureCountRef.current,
          sender_account_type: classifyPayerCode(payerCode),
          wallet_id: connector?.id,
          wallet_name: connector?.name,
        });
      }
      } finally {
        if (attemptId) releasePaymentAttempt(attemptId);
        transferInFlightRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [walletPaymentOptions, rozoPaymentId, order, rozoPaymentState],
  );

  useEffect(() => {
    if (!pendingPaymentAttemptId && payState === PayState.WaitingForWallet) {
      setPayState(PayState.RequestCancelled);
    }
  }, [pendingPaymentAttemptId, payState]);

  useEffect(() => {
    failureCountRef.current = 0;
    setLastFailure(null);
    if (!selectedTokenOption) return;

    const currentState = store.getState();
    const currentOrder = currentState.type !== "idle" ? currentState.order : undefined;
    const orderKey = currentOrder?.externalId ?? String(currentOrder?.id ?? "");
    if (!orderKey || autoTransferOrderRef.current === orderKey) return;

    const transferTimeout = setTimeout(() => {
      // Claim the order only when the transfer actually starts. React StrictMode
      // (dev) runs this effect setup → cleanup → setup: the first run schedules
      // this timer, the cleanup clears it, and the second run must be allowed to
      // re-schedule it. Claiming the order before the timer made the second run
      // bail out on the guard, so the wallet request was never made and the
      // modal stalled on "Preparing Transaction".
      if (autoTransferOrderRef.current === orderKey) return;
      autoTransferOrderRef.current = orderKey;
      handleTransfer(selectedTokenOption);
    }, 100);
    return () => {
      clearTimeout(transferTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTokenOption]);

  useEffect(() => {
    triggerResize();
    setWalletPaymentState(
      payState === PayState.WaitingForConfirmation ||
        payState === PayState.WaitingForWallet
        ? "waiting"
        : "idle",
    );
    return () => setWalletPaymentState("idle");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payState]);

  const promotePayAnotherWay = shouldPromotePayAnotherWay(
    lastFailure,
    failureCountRef.current,
  );
  const failureMessage = walletFailureMessage(lastFailure, connector?.name);
  // Manual transfer to a one-time deposit address: the wallet's own send UI
  // takes over, which is the path that worked for the 2026-10-26 payer whose
  // wallet refused every dapp-initiated eth_sendTransaction.
  const handlePayAnotherWay = () => {
    capture(ROZO_EVENTS.PAYMENT_METHOD_SELECTED, {
      field: "fallback",
      value: "deposit_address",
      failure_kind: lastFailure?.kind,
      consecutive_failures: failureCountRef.current,
      source_chain: selectedTokenOption?.required.token.chainId,
    });
    setRoute(ROUTES.SELECT_DEPOSIT_ADDRESS_CHAIN);
  };

  if (selectedTokenOption == null) {
    return <PageContent></PageContent>;
  }

  if (payState === PayState.WaitingForWallet) {
    return (
      <PageContent>
        <TokenLogoSpinner token={selectedTokenOption.required.token} />
        <ModalContent style={{ paddingBottom: 0 }} $preserveDisplay={true}>
          <ModalBody>
            Wallet confirmation pending
          </ModalBody>
        </ModalContent>
      </PageContent>
    );
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
          <ModalH1>
            {payState === PayState.RequestCancelled
              ? (walletFailureTitle(lastFailure) ?? payState)
              : payState}
          </ModalH1>
        )}
        {payState === PayState.RequestCancelled && failureMessage && (
          <ModalBody>{failureMessage}</ModalBody>
        )}
        {payState === PayState.NetworkFeeNeeded && noGasMessage && (
          <ModalBody>{noGasMessage}</ModalBody>
        )}
        {payState !== PayState.NetworkFeeNeeded &&
          (payState !== PayState.RequestCancelled || (feeData && !feeLoading)) && (
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
        )}
        {payState === PayState.RequestCancelled && promotePayAnotherWay && (
          <>
            <Button variant="primary" onClick={handlePayAnotherWay}>
              Pay another way
            </Button>
            <Button variant="secondary" onClick={() => handleTransfer(selectedTokenOption)}>
              Retry Payment
            </Button>
          </>
        )}
        {payState === PayState.RequestCancelled && !promotePayAnotherWay && (
          <>
            <Button onClick={() => handleTransfer(selectedTokenOption)}>
              Retry Payment
            </Button>
            <Button variant="tertiary" onClick={handlePayAnotherWay}>
              Pay another way
            </Button>
          </>
        )}
        {payState === PayState.NetworkFeeNeeded && (
          <>
            <Button variant="primary" onClick={() => handleTransfer(selectedTokenOption)}>
              I added {noGasSymbol ?? "gas"}, check again
            </Button>
            <Button
              variant="tertiary"
              onClick={() =>
                handleTransfer(selectedTokenOption, { skipGasPrecheck: true })
              }
            >
              Try anyway
            </Button>
          </>
        )}
        {payState === PayState.RequestFailed && (
          <Button onClick={handleContactClick}>Contact Support</Button>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithToken;
