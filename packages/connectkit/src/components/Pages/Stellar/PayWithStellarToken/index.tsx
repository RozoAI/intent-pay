import React, { useEffect, useMemo, useRef, useState } from "react";
import { ROUTES } from "../../../../constants/routes";
import { usePayContext } from "../../../../hooks/usePayContext";
import { STELLAR_INSUFFICIENT_XLM_BASE } from "../../../../constants/rozoConfig";

import {
  Link,
  ModalBody,
  ModalContent,
  ModalH1,
  PageContent,
} from "../../../Common/Modal/styles";

import {
  buildCheckoutPayload,
  checkoutPayment,
  FeeResponseData,
  formatPaymentResponseToHydratedOrder,
  getCanonicalDestination,
  getChainExplorerTxUrl,
  getPayment,
  isNativeToken,
  RozoPayHydratedOrderWithOrg,
  rozoStellar,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { formatUnits } from "viem";
import type { FeeBumpTransaction, Transaction } from "@stellar/stellar-sdk";
import { useContactSupport } from "../../../../hooks/useContactSupport";
import { useRozoPay } from "../../../../hooks/useRozoPay";
import {
  beginRequestScope,
  isAbortError,
  PAYMENT_REQUEST_SCOPE,
} from "../../../../utils/paymentRequestScope";
import { ROZO_EVENTS } from "../../../../lib/analytics/events";
import { useAnalytics } from "../../../../provider/AnalyticsProvider";
import { useStellar } from "../../../../provider/StellarContextProvider";
import { buildFeeQuoteParams, getCachedFee } from "../../../../utils/feeCache";
import Button from "../../../Common/Button";
import PaymentBreakdown from "../../../Common/PaymentBreakdown";
import TokenLogoSpinner from "../../../Spinners/TokenLogoSpinner";
import {
  categorizeError,
  createPaymentFailureError,
  ErrorType,
  parseErrorMessage,
} from "../../../../utils/errorParser";
import {
  resolveSourceAmountUnits,
  resolveWalletPaymentAmount,
  resolveWalletSourceBreakdown,
  type WalletSourceQuoteOrder,
  withWalletSourceQuote,
} from "../../../../payment/createPaymentPayload";
import {
  isSamePaymentSource,
  normalizeSourceTokenAddress,
  sourceTokenChainId,
} from "../../../../utils/token";
import { waitForPaymentSourceTxHash } from "../../../../payment/waitForPaymentSourceTxHash";
import { WALLET_CONNECT_ID } from "../../../../utils/stellar/walletconnect.module";
import { resolveStellarSubmissionOutcome } from "../../../../payment/resolveStellarSubmissionOutcome";
import {
  CONFIRMED_ENTRY_TTL_MS,
  clearPendingStellarSubmission,
  readPendingStellarSubmissions,
  savePendingStellarSubmission,
} from "../../../../payment/stellarPendingSubmission";

enum PayState {
  PreparingTransaction = "Preparing Transaction",
  WaitingForConfirmation = "Waiting for Confirmation",
  ProcessingPayment = "Processing Payment",
  RequestCancelled = "Payment Cancelled",
  RequestFailed = "Payment Failed",
  RequestSuccessful = "Payment Successful",
  WaitingForWallet = "Wallet Confirmation Pending",
  OutcomeUnknown = "Payment Status Unknown",
  PreviousPaymentConfirmed = "Previous Payment Confirmed",
}

// A WalletConnect SIGN_AND_SUBMIT can report "pending" before broadcasting,
// the pending submission may later fail, and some wallets broadcast but
// answer with no/unexpected status or an error ("unknown"). We can't safely
// resubmit locally (the wallet already attempted it) and must not let the
// user sign a second transaction while the first may still land, so we
// resolve the outcome on chain: the tx hash is computed from the XDR we sent
// and looked up on Horizon until the tx's max_time has provably passed (see
// resolveStellarSubmissionOutcome), racing the backend's observed source tx
// hash. If neither proves an outcome we show "status unknown" with no retry.
// The unresolved tx is persisted per source account (stellarPendingSubmission)
// so re-entering checkout must resolve it on chain before signing again.

const PayWithStellarToken: React.FC = () => {
  const { triggerResize, paymentState, setRoute, log } = usePayContext();
  const {
    selectedStellarTokenOption,
    payWithStellarToken,
    setTxHash,
    payParams,
    rozoPaymentId,
    setRozoPaymentId,
    createPayment,
    stellarPaymentOptions,
    pendingPaymentAttemptId,
    tryClaimPaymentAttempt,
    replacePaymentAttempt,
    releasePaymentAttempt,
    clearPaymentAttempt,
    setWalletPaymentState,
  } = paymentState;
  const {
    store,
    order,
    paymentState: state,
    setPaymentStarted,
    setPaymentUnpaid,
    hydrateOrder,
  } = useRozoPay();
  const handleContactClick = useContactSupport();

  // Get the destination address and payment direction using our custom hook
  const {
    server: stellarServer,
    publicKey: stellarPublicKey,
    kit: stellarKit,
    connector: stellarConnector,
  } = useStellar();
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const paymentAttemptIdRef = useRef<string | undefined>();
  const signingRef = useRef(false);
  const previousConfirmedTxRef = useRef<string | undefined>();
  const autoTransferOrderRef = useRef<string | null>(null);
  // Dedupes the payId fetch+checkout across overlapping handleTransfer calls
  // (e.g. the auto-transfer effect firing twice in quick succession). Claimed
  // synchronously — before any await — so a second call always sees and
  // awaits the first call's in-flight promise instead of racing past a
  // not-yet-true guard.
  const checkoutInFlightRef = useRef<Promise<{
    hydratedOrder: RozoPayHydratedOrderWithOrg;
    paymentId: string | undefined;
    settlementMode: string | undefined;
  }> | null>(null);

  const { capture } = useAnalytics();
  const [payState, setPayState] = useState<PayState>(
    PayState.PreparingTransaction,
  );
  const [txURL, setTxURL] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [signedTx, setSignedTx] = useState<string | undefined>();
  const [feeData, setFeeData] = useState<FeeResponseData | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);

  // useEffect(() => {
  //   if (!selectedStellarTokenOption || !order) return;

  //   const destToken = order.destFinalCallTokenAmount?.token;
  //   if (!destToken) return;

  //   setFeeLoading(true);
  //   getCachedFee({
  //     appId: payParams?.appId,
  //     type: payParams?.feeType ?? FeeType.ExactIn,
  //     sourceChainId:
  //       selectedStellarTokenOption.balance.token.chainId.toString(),
  //     sourceTokenSymbol: selectedStellarTokenOption.balance.token.symbol,
  //     amount: selectedStellarTokenOption.required.usd.toString(),
  //     destChainId: destToken.chainId.toString(),
  //     destReceiverAddress:
  //       getCanonicalDestination(order).finalDestinationAddress ??
  //       payParams?.toStellarAddress ??
  //       payParams?.toAddress ??
  //       "",
  //     destTokenSymbol: destToken.symbol,
  //   })
  //     .then((res) => {
  //       setFeeData(res.data);
  //     })
  //     .finally(() => {
  //       setFeeLoading(false);
  //     });
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [selectedStellarTokenOption?.balance.token.chainId, order?.id]);

  const destinationAddress = useMemo(() => {
    return (
      payParams?.toStellarAddress ||
      payParams?.toSolanaAddress ||
      payParams?.toAddress ||
      undefined
    );
  }, [
    payParams?.toStellarAddress,
    payParams?.toSolanaAddress,
    payParams?.toAddress,
  ]);

  useEffect(() => {
    if (state === "error") {
      setRoute(ROUTES.ERROR);
      return;
    }
  }, [state]);

  // FOR TRANSFER ACTION
  const handleTransfer = async (option: WalletPaymentOption) => {
    setIsLoading(true);
    capture(ROZO_EVENTS.PAYMENT_CONFIRMED, {
      payment_id: rozoPaymentId ?? order?.externalId,
      source_chain: option.required.token.chainId,
      token_symbol: option.required.token.symbol,
      amount:
        option.required.usd != null ? String(option.required.usd) : undefined,
    });
    // Hoist so the catch block can reference the payment ID resolved in this
    // attempt, instead of the stale React state value captured in the closure.
    let resolvedPaymentId: string | undefined;
    let attemptId: string | undefined;
    let keepAttemptLock = false;
    try {
      // Validate we have current payParams - if not, check if we're in payId mode
      // (pre-created payment). If neither, component has stale state.
      if (!payParams && !order?.externalId) {
        log?.(
          "[PayWithStellarToken] No payParams or payId available, skipping transfer",
        );
        setIsLoading(false);
        return;
      }

      if (!destinationAddress && !order?.externalId) {
        throw new Error("Stellar destination address is required");
      }

      log?.("[PayWithStellarToken] Starting transfer with:", {
        destinationAddress,
        chainId: payParams?.toChain,
        toStellarAddress: payParams?.toStellarAddress,
      });

      // Read the freshest order straight from the store instead of the React
      // closure snapshot. For payId mode this is the getPayment-derived order
      // loaded by runSetPayIdEffects, so getFee/checkout below run against the
      // latest payment response (correct appId, amount, destination, etc.).
      const currentState = store.getState();
      const currentOrder =
        currentState.type !== "idle" ? currentState.order : undefined;
      if (!currentOrder) {
        throw new Error("Order not initialized");
      }
      attemptId = currentOrder.externalId ?? String(currentOrder.id);
      if (!tryClaimPaymentAttempt(attemptId)) {
        log?.("[PayWithStellarToken] wallet request already pending");
        capture(ROZO_EVENTS.PAYMENT_WALLET_CONFIRMATION_PENDING, {
          payment_id: currentOrder.externalId,
          source_chain: option.required.token.chainId,
          token_symbol: option.required.token.symbol,
        });
        setPayState(PayState.WaitingForWallet);
        return;
      }

      const { required } = option;

      const tokenChanged =
        currentOrder.preferredTokenAddress != null &&
        normalizeSourceTokenAddress(
          Number(currentOrder.preferredChainId ?? required.token.chainId),
          currentOrder.preferredTokenAddress,
        ) !== normalizeSourceTokenAddress(required.token.chainId, required.token.token);
      const needRozoPayment =
        (currentOrder.preferredChainId !== null &&
          sourceTokenChainId(Number(currentOrder.preferredChainId)) !==
            sourceTokenChainId(required.token.chainId)) ||
        tokenChanged;

      let hydratedOrder: RozoPayHydratedOrderWithOrg;
      let paymentId: string | undefined;
      let settlementMode: string | undefined;

      // When payId is used (no payParams), fetch the existing payment instead
      // of creating a new one to avoid re-creating a payment that already exists.
      const existingPayId = currentOrder.externalId ?? undefined;
      const isPayIdMode = !payParams && !!existingPayId;

      // @NOTE: Fee calculation
      const destToken = currentOrder.destFinalCallTokenAmount?.token;
      const destAmountAtomic = currentOrder.destFinalCallTokenAmount?.amount;
      const toUnits = destAmountAtomic && destToken
        ? formatUnits(BigInt(destAmountAtomic), destToken.decimals)
        : option.required.usd.toString();
      const request = beginRequestScope(PAYMENT_REQUEST_SCOPE);

      // Stored payment/checkout quote for this source is authoritative —
      // render it directly instead of a redundant, possibly-divergent getFee.
      const storedBreakdown = resolveWalletSourceBreakdown(
        currentOrder as WalletSourceQuoteOrder,
        option.required.token,
      );
      let quoteData: FeeResponseData | null = storedBreakdown ?? null;
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

      if (isPayIdMode && !storedBreakdown) {
        // payId mode: checkout (refresh) the payment with the selected source token.
        // Claim checkoutInFlightRef synchronously (no await before this point
        // in the branch) so a second overlapping handleTransfer call — e.g.
        // the auto-transfer effect firing twice in quick succession — always
        // sees and awaits this same promise instead of racing past a
        // not-yet-set guard and firing a second checkout POST.
        if (!checkoutInFlightRef.current) {
          checkoutInFlightRef.current = (async () => {
            const paymentRes = await getPayment(existingPayId!, undefined, {
              signal: request.signal,
            });
            if (paymentRes.error) {
              throw paymentRes.error;
            }
            if (!paymentRes?.data) {
              throw new Error("Failed to fetch payment");
            }
            if (request.signal.aborted) {
              throw new Error("Aborted");
            }
            if (isSamePaymentSource(paymentRes.data, option.required.token)) {
              return {
                paymentId: paymentRes.data.id,
                settlementMode: paymentRes.data.settlementMode,
                hydratedOrder: withWalletSourceQuote(
                  formatPaymentResponseToHydratedOrder(paymentRes.data),
                  paymentRes.data,
                ),
              };
            }
            const checkoutRes = await checkoutPayment(
              existingPayId!,
              buildCheckoutPayload(paymentRes.data, {
                chainId: option.required.token.chainId,
                tokenSymbol: option.required.token.symbol,
                tokenAddress: option.required.token.token,
                amount: resolveSourceAmountUnits(option.required),
              }),
              undefined,
              { signal: request.signal },
            );
            if (checkoutRes.error) {
              throw checkoutRes.error;
            }
            if (!checkoutRes?.data) {
              throw new Error("Failed to checkout payment");
            }
            return {
              paymentId: checkoutRes.data.id,
              settlementMode: checkoutRes.data.settlementMode,
              hydratedOrder: withWalletSourceQuote(
                formatPaymentResponseToHydratedOrder(checkoutRes.data),
                checkoutRes.data,
              ),
            };
          })();
        } else {
          log?.(
            "[PayWithStellarToken] isPayIdMode checkout already in flight, awaiting shared result",
          );
        }

        const checkoutResult = await checkoutInFlightRef.current;
        paymentId = checkoutResult.paymentId;
        settlementMode = checkoutResult.settlementMode;
        hydratedOrder = checkoutResult.hydratedOrder;
      } else if (
        (state === "payment_unpaid" || state === "payment_started") &&
        !needRozoPayment
      ) {
        hydratedOrder = currentOrder as RozoPayHydratedOrderWithOrg;
      } else if (needRozoPayment) {
        const existingId = rozoPaymentId ?? currentOrder.externalId ?? undefined;
        // Backend rejects checkout when rotating to native XLM.
        if (existingId && !isNativeToken(option.required.token.token)) {
          const paymentRes = await getPayment(existingId, undefined, {
            signal: request.signal,
          });
          if (paymentRes.error) {
            throw paymentRes.error;
          }
          if (!paymentRes?.data) {
            throw new Error("Failed to fetch payment");
          }
          if (request.signal.aborted) {
            throw new Error("Aborted");
          }
          const checkoutRes = await checkoutPayment(
            existingId,
            buildCheckoutPayload(paymentRes.data, {
              chainId: option.required.token.chainId,
              tokenSymbol: option.required.token.symbol,
              tokenAddress: option.required.token.token,
              amount: resolveSourceAmountUnits(option.required),
            }),
            undefined,
            { signal: request.signal },
          );
          if (checkoutRes.error) {
            throw checkoutRes.error;
          }
          if (!checkoutRes?.data) {
            throw new Error("Failed to checkout payment");
          }
          paymentId = checkoutRes.data.id;
          settlementMode = checkoutRes.data.settlementMode;
          hydratedOrder = withWalletSourceQuote(
            formatPaymentResponseToHydratedOrder(checkoutRes.data),
            checkoutRes.data,
          );
        } else {
          const res = await createPayment(
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
          );
          if (!res) {
            throw createPaymentFailureError(store);
          }
          paymentId = res.id;
          settlementMode = res.settlementMode;
          hydratedOrder = withWalletSourceQuote(
            formatPaymentResponseToHydratedOrder(res),
            res,
          );
        }
      } else {
        // Hydrate existing order
        const res = await hydrateOrder(undefined, {
          ...option,
          fees: {
            ...option.fees,
            usd:
              quoteData?.source.fee != null
                ? Number(quoteData.source.fee)
                : option.fees.usd,
          },
        }, { signal: request.signal });
        hydratedOrder = res.order;
      }

      if (!hydratedOrder) {
        throw new Error("Payment not found");
      }

      const newId = paymentId ?? hydratedOrder.externalId ?? undefined;
      resolvedPaymentId = newId;
      if (attemptId && newId && newId !== attemptId) {
        replacePaymentAttempt(attemptId, newId);
        attemptId = newId;
      }

      if (newId) {
        setRozoPaymentId(newId);

        // Handle payment state transitions
        // Get the ACTUAL current state from the store, not the stale React state
        const currentState = store.getState().type;

        if (currentState === "payment_started" && paymentId) {
          // A new payment was created while in payment_started state (cross-chain switch)
          // First transition back to payment_unpaid, then to payment_started with new order
          const oldPaymentId = order?.externalId;
          if (oldPaymentId) {
            try {
              await setPaymentUnpaid(oldPaymentId);
              await setPaymentStarted(String(newId), hydratedOrder);
            } catch (e) {
              // State might have changed during async operations
              console.warn(
                "[PayWithStellarToken] State transition failed, attempting direct start:",
                e,
              );
              // Try to set started directly if state is already unpaid
              try {
                await setPaymentStarted(String(newId), hydratedOrder);
              } catch (e2) {
                console.error(
                  "[PayWithStellarToken] Could not start payment:",
                  e2,
                );
                throw e2;
              }
            }
          } else {
            await setPaymentStarted(String(newId), hydratedOrder);
          }
        } else if (currentState !== "payment_started") {
          // State is not payment_started (preview, unhydrated, or payment_unpaid)
          // Only transition to payment_started if we're in payment_unpaid
          const stateBeforeTransition = store.getState().type;
          if (stateBeforeTransition === "payment_unpaid") {
            try {
              await setPaymentStarted(String(newId), hydratedOrder);
            } catch (e) {
              console.error(
                "[PayWithStellarToken] Could not start payment:",
                e,
              );
              throw e;
            }
          } else if (stateBeforeTransition === "preview") {
            // Transition from preview -> payment_unpaid -> payment_started
            await setPaymentUnpaid(String(newId), hydratedOrder);
            await setPaymentStarted(String(newId), hydratedOrder);
          } else {
            log?.(
              `[PayWithStellarToken] Skipping setPaymentStarted - state is ${stateBeforeTransition}, needs to be payment_unpaid`,
            );
          }
        }
      }

      setPayState(PayState.WaitingForConfirmation);

      // Double-check destination address matches the payment direction
      const finalDestAddress = hydratedOrder.intentAddr || destinationAddress;

      if (!finalDestAddress) {
        throw new Error("Destination address not found");
      }

      log?.(
        `[PayWithStellarToken] Payment setup - destAddress: ${finalDestAddress}, toChain: ${payParams?.toChain}, token chain: ${option.required.token.chainId}`,
      );

      // Replace provisional getFee data with payment/checkout response values.
      const canonicalBreakdown = (hydratedOrder as WalletSourceQuoteOrder).paymentBreakdown;
      if (canonicalBreakdown) setFeeData(canonicalBreakdown);

      // For stellar_direct: source IS the destination. Use source address/amount/memo directly.
      // The hydratedOrder's intentAddr already points to the source (deposit) address,
      // and fee is "0.00", so we just pass through.
      const paymentData = {
        destAddress: finalDestAddress,
        amount: resolveWalletPaymentAmount(
          hydratedOrder as WalletSourceQuoteOrder,
          option,
        ),
      };

      if (hydratedOrder.memo) {
        Object.assign(paymentData, {
          memo: hydratedOrder.memo,
        });
      }

      log?.(
        `[PayWithStellarToken] settlementMode: ${settlementMode ?? "none"}, destAddress: ${finalDestAddress}, memo: ${hydratedOrder.memo ?? "none"}`,
      );

      const result = await payWithStellarToken(
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
        paymentData,
      );
      paymentAttemptIdRef.current = attemptId;
      keepAttemptLock = true;
      setSignedTx(result.signedTx);
      setPayState(PayState.WaitingForConfirmation);
    } catch (error) {
      // Abort = user navigated away (Back / reset). Not a payment failure.
      if (isAbortError(error)) {
        checkoutInFlightRef.current = null;
        return;
      }

      console.error("[PayWithStellarToken] Error:", error);
      clearPaymentAttempt();

      // Clear the in-flight guard so a Retry Payment click (a genuine new
      // attempt) can re-checkout instead of forever awaiting this failed
      // attempt's rejected promise.
      checkoutInFlightRef.current = null;

      // Use `resolvedPaymentId` (the ID from this attempt) rather than
      // the stale `rozoPaymentId` from the React state closure.
      const paymentIdToReset = resolvedPaymentId ?? rozoPaymentId;
      if (paymentIdToReset) {
        try {
          await setPaymentUnpaid(paymentIdToReset);
        } catch (e) {
          console.error("Failed to set payment unpaid:", e);
        }
      }

      const errorMessage =
        parseErrorMessage(error);
      const isRejected = errorMessage.includes("rejected");
      capture(ROZO_EVENTS.PAYMENT_FAILED, {
        payment_id: resolvedPaymentId ?? rozoPaymentId,
        error_message: isRejected
          ? "user_rejected"
          : (errorMessage ?? "unknown_error"),
        source_chain: rozoStellar.chainId,
      });
      if (isRejected) {
        // User rejected in-wallet before signing — keep them in-modal with a
        // Retry affordance instead of the full Error page.
        setPayState(PayState.RequestCancelled);
      } else {
        // Pre-submit failure (setup/network/checkout). Route to the dedicated
        // Error page for proper categorization + retry/support.
        setRoute(ROUTES.ERROR, { error: errorMessage });
      }
    } finally {
      if (attemptId && !keepAttemptLock) releasePaymentAttempt(attemptId);
      setIsLoading(false);
    }
  };

  const handleSubmitTx = async () => {
    const attemptId = paymentAttemptIdRef.current;
    if (signedTx && stellarServer && stellarKit && attemptId) {
      const currentState = store.getState();
      const currentPaymentId =
        currentState.type !== "idle" && currentState.order
          ? currentState.order.externalId ?? String(currentState.order.id)
          : undefined;
      if (currentPaymentId !== attemptId) {
        setSignedTx(undefined);
        paymentAttemptIdRef.current = undefined;
        clearPaymentAttempt();
        return;
      }
      signingRef.current = true;
      try {
        // @stellar/stellar-sdk is ~14M — load it only when actually
        // submitting a Stellar transaction, not on every modal mount.
        const { Networks, TransactionBuilder } = await import("@stellar/stellar-sdk");
        const activePaymentId = rozoPaymentId ?? order?.externalId;
        const finishSubmission = (
          txHash: string,
          extra?: Record<string, unknown>,
        ) => {
          capture(ROZO_EVENTS.PAYMENT_SUBMITTED, {
            payment_id: activePaymentId,
            tx_hash: txHash,
            source_chain: rozoStellar.chainId,
            token_symbol: selectedStellarTokenOption?.required.token.symbol,
            ...extra,
          });
          try {
            sessionStorage.setItem(
              `rozo_submitted_at:${activePaymentId}`,
              String(Date.now()),
            );
          } catch {}
          setPayState(PayState.RequestSuccessful);
          setTxHash(txHash);
          setTxURL(getChainExplorerTxUrl(rozoStellar.chainId, txHash));
          // Do NOT mark the payment completed here: transaction submission is
          // not the API confirming the deposit for this order.
          setTimeout(() => {
            setSignedTx(undefined);
            setRoute(ROUTES.CONFIRMATION, { event: "wait-pay-with-stellar" });
          }, 200);
          setTimeout(() => {
            stellarPaymentOptions.refreshOptions();
          }, 1000);
        };

        const isWalletConnect = stellarConnector?.id === WALLET_CONNECT_ID;
        // The hash does not depend on signatures, so the XDR we hand to the
        // wallet identifies the transaction it may broadcast.
        const sentTx = TransactionBuilder.fromXDR(signedTx, Networks.PUBLIC);
        const sentTxHash = Array.from(sentTx.hash())
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("");
        const sentTimeBounds =
          "innerTransaction" in sentTx
            ? sentTx.innerTransaction.timeBounds
            : sentTx.timeBounds;
        const sentMaxTime = Number(sentTimeBounds?.maxTime ?? 0);

        const resolveOnChain = (
          txHash: string,
          maxTime: number,
          signal?: AbortSignal,
        ) =>
          resolveStellarSubmissionOutcome({
            txHash,
            maxTime,
            signal,
            lookupTx: async (hash) => {
              try {
                const record = await stellarServer
                  .transactions()
                  .transaction(hash)
                  .call();
                return { found: true, successful: record.successful === true };
              } catch (error: any) {
                if (
                  error?.response?.status === 404 ||
                  error?.name === "NotFoundError"
                ) {
                  return { found: false };
                }
                throw error;
              }
            },
            latestLedgerCloseTime: async () => {
              const page = await stellarServer
                .ledgers()
                .order("desc")
                .limit(1)
                .call();
              const closedAt = page.records[0]?.closed_at;
              return closedAt ? Date.parse(closedAt) / 1000 : Number.NaN;
            },
          });

        const reportUnresolved = (
          kind: "failed" | "expired" | "unknown",
          txHash: string,
          walletStatus: string | undefined,
        ) => {
          // Definite failure (failed on chain, or provably never included)
          // or still unknown. Either way drop the old XDR so nothing can
          // resubmit it.
          setSignedTx(undefined);
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: attemptId,
            error_message:
              kind === "unknown"
                ? "wallet_submission_outcome_unknown"
                : "payment_unsuccessful",
            submission_outcome:
              kind === "failed"
                ? "failed_on_chain"
                : kind === "expired"
                  ? "expired_not_on_chain"
                  : "outcome_unknown",
            wallet_status: walletStatus,
            tx_hash: txHash,
            source_chain: rozoStellar.chainId,
          });
          setPayState(
            kind === "unknown" ? PayState.OutcomeUnknown : PayState.RequestFailed,
          );
        };

        const markConfirmed = (txHash: string, walletStatus?: string) => {
          // Only after an unknown wallet status: keep the record after the
          // on-chain success so a later checkout from this account must be
          // acknowledged before it can pay again.
          if (stellarPublicKey) {
            savePendingStellarSubmission(stellarPublicKey, {
              txHash,
              maxTime: sentMaxTime,
              paymentId: attemptId,
              walletStatus,
              confirmed: true,
              recordedAt: Date.now(),
            });
          }
        };
        const showPreviousPaymentConfirmed = (
          txHash: string,
          previousPaymentId: string | undefined,
        ) => {
          setSignedTx(undefined);
          previousConfirmedTxRef.current = txHash;
          setTxURL(getChainExplorerTxUrl(rozoStellar.chainId, txHash));
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: attemptId,
            error_message: "previous_payment_confirmed_on_chain",
            submission_outcome: "unknown_resolved_on_chain",
            previous_payment_id: previousPaymentId,
            tx_hash: txHash,
            source_chain: rozoStellar.chainId,
          });
          setPayState(PayState.PreviousPaymentConfirmed);
        };

        // Never request a new signature from an account whose previous
        // wallet submission is unresolved (it may already be on chain) or
        // recently confirmed for another order, unless the user explicitly
        // acknowledged it ("Pay again" clears the record).
        const pendingRecords = stellarPublicKey
          ? readPendingStellarSubmissions(stellarPublicKey)
          : [];
        let resolvedPending = false;
        for (const pending of pendingRecords) {
          if (!stellarPublicKey) break;
          if (
            pending.confirmed &&
            Date.now() - pending.recordedAt > CONFIRMED_ENTRY_TTL_MS
          ) {
            clearPendingStellarSubmission(stellarPublicKey, pending.txHash);
            continue;
          }
          let priorKind: "success" | "failed" | "expired" | "unknown";
          if (pending.confirmed) {
            priorKind = "success";
          } else {
            resolvedPending = true;
            setIsLoading(true);
            setPayState(PayState.ProcessingPayment);
            const prior = await resolveOnChain(pending.txHash, pending.maxTime);
            priorKind = prior.kind;
            log?.(
              `[PAY STELLAR] Previous unresolved submission ${pending.txHash} resolved as ${prior.kind}`,
            );
          }
          if (priorKind === "unknown") {
            reportUnresolved("unknown", pending.txHash, pending.walletStatus);
            return;
          }
          if (priorKind === "success") {
            savePendingStellarSubmission(stellarPublicKey, {
              ...pending,
              confirmed: true,
              recordedAt: pending.confirmed ? pending.recordedAt : Date.now(),
            });
            if (pending.paymentId === attemptId) {
              finishSubmission(pending.txHash, {
                wallet_status: pending.walletStatus,
                submission_outcome: "unknown_resolved_on_chain",
              });
              return;
            }
            // The earlier payment from this account landed for another
            // order. Stop here so the user does not pay twice.
            showPreviousPaymentConfirmed(pending.txHash, pending.paymentId);
            return;
          }
          // failed / expired: that tx can never land.
          clearPendingStellarSubmission(stellarPublicKey, pending.txHash);
        }
        if (resolvedPending) {
          setIsLoading(false);
          setPayState(PayState.WaitingForConfirmation);
        }

        const resolveWalletConnectOutcome = async (
          walletStatus: string | undefined,
          backendHashPromise?: Promise<{ txHash: string }>,
          signal?: AbortSignal,
        ) => {
          setIsLoading(true);
          setPayState(PayState.ProcessingPayment);
          if (stellarPublicKey) {
            savePendingStellarSubmission(stellarPublicKey, {
              txHash: sentTxHash,
              maxTime: sentMaxTime,
              paymentId: attemptId,
              walletStatus,
              recordedAt: Date.now(),
            });
          }
          const horizonOutcome = resolveOnChain(sentTxHash, sentMaxTime, signal);
          const outcome = backendHashPromise
            ? await Promise.race([
                horizonOutcome,
                backendHashPromise.then(({ txHash: backendHash }) => ({
                  kind: "backend" as const,
                  txHash: backendHash,
                })),
              ])
            : await horizonOutcome;

          log?.(
            `[PAY STELLAR] WalletConnect status "${walletStatus}" resolved as ${outcome.kind}: ${outcome.txHash}`,
          );
          if (outcome.kind === "unknown") {
            // Keep the persisted entry: the next attempt must resolve it.
            reportUnresolved("unknown", outcome.txHash, walletStatus);
            return;
          }
          if (outcome.kind === "success" || outcome.kind === "backend") {
            markConfirmed(outcome.txHash, walletStatus);
            finishSubmission(outcome.txHash, {
              wallet_status: walletStatus,
              submission_outcome:
                outcome.kind === "success"
                  ? "unknown_resolved_on_chain"
                  : "unknown_resolved_by_api",
            });
            return;
          }
          // failed / expired: the tx can never land.
          if (stellarPublicKey) {
            clearPendingStellarSubmission(stellarPublicKey, sentTxHash);
          }
          reportUnresolved(outcome.kind, outcome.txHash, walletStatus);
        };

        // WalletConnect signs AND broadcasts in the wallet, so the tx may land
        // even if this page closes before the wallet answers. Record it
        // before the request so a later attempt resolves it on chain first.
        const clearSentPending = () => {
          if (isWalletConnect && stellarPublicKey) {
            // Never drop a record the API or chain already confirmed.
            clearPendingStellarSubmission(
              stellarPublicKey,
              sentTxHash,
              undefined,
              { keepConfirmed: true },
            );
          }
        };
        if (isWalletConnect && stellarPublicKey) {
          savePendingStellarSubmission(stellarPublicKey, {
            txHash: sentTxHash,
            maxTime: sentMaxTime,
            paymentId: attemptId,
            walletStatus: "requested",
            recordedAt: Date.now(),
          });
        }
        const signingPromise = stellarKit
          .signTransaction(signedTx, {
            address: stellarPublicKey,
            networkPassphrase: Networks.PUBLIC,
            submit: isWalletConnect,
          })
          .catch((error: unknown) => {
            // The module only throws before the request is sent or on an
            // explicit user rejection: nothing was broadcast.
            clearSentPending();
            throw error;
          });
        let signedTransaction: Awaited<typeof signingPromise> & {
          submitted?: boolean;
          submissionStatus?: string;
        };

        if (isWalletConnect && activePaymentId) {
          const pollingController = new AbortController();
          const backendHashPromise = waitForPaymentSourceTxHash(
            activePaymentId,
            {
              signal: pollingController.signal,
              ignoreTxHash:
                order && "sourceStartTxHash" in order
                  ? order.sourceStartTxHash
                  : undefined,
              isValidTxHash: (txHash): txHash is string =>
                /^[0-9a-f]{64}$/i.test(txHash),
            },
          ).then((txHash) => ({ txHash }));
          try {
            const result = await Promise.race([
              signingPromise.then((transaction) => ({
                transaction: transaction as Awaited<typeof signingPromise> & {
                  submitted?: boolean;
                  submissionStatus?: string;
                },
              })),
              backendHashPromise,
            ]);

            if ("txHash" in result) {
              log?.(
                `[PAY STELLAR] Recovered WalletConnect tx hash from payment API: ${result.txHash}`,
              );
              // The API saw this order's payment, but the wallet has not
              // answered yet and may never confirm. Keep a confirmed record
              // until the wallet itself reports success, so a lost wallet
              // response still needs acknowledgement before paying again.
              markConfirmed(result.txHash, "api");
              signingPromise
                .then((transaction) => {
                  if (
                    stellarPublicKey &&
                    (transaction as { submitted?: boolean }).submitted === true
                  ) {
                    clearPendingStellarSubmission(
                      stellarPublicKey,
                      result.txHash,
                    );
                    clearPendingStellarSubmission(stellarPublicKey, sentTxHash);
                  }
                })
                .catch(() => {});
              finishSubmission(result.txHash);
              return;
            }

            // The wallet's SIGN_AND_SUBMIT returned before the backend saw a
            // hash. If it reported "success" (submitted:true), trust it.
            // If it reported "pending", an unexpected/missing status, or a
            // non-rejection error (submitted:false), do NOT fall through to
            // local resubmission: WalletConnect already attempted the
            // broadcast and signedTxXdr here is not a locally-resubmittable
            // transaction. Resolve the outcome on Horizon by hash while still
            // racing the backend's source tx hash; never offer a plain retry
            // while the first transaction may still land.
            if (!result.transaction.submitted) {
              await resolveWalletConnectOutcome(
                result.transaction.submissionStatus,
                backendHashPromise,
                pollingController.signal,
              );
              return;
            }
            signedTransaction = result.transaction;
          } finally {
            pollingController.abort();
          }
        } else {
          signedTransaction = await signingPromise;
        }

        if (signedTransaction.submitted) {
          const submittedTx = TransactionBuilder.fromXDR(
            signedTx,
            Networks.PUBLIC,
          );
          const txHash = Array.from(submittedTx.hash())
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
          clearSentPending();
          finishSubmission(txHash);
          return;
        }

        if (isWalletConnect) {
          // Same as above, without a payment id to poll the backend with.
          // signedTxXdr is the unsigned XDR here, never resubmit it locally.
          await resolveWalletConnectOutcome(signedTransaction.submissionStatus);
          return;
        }

        setIsLoading(true);
        setPayState(PayState.ProcessingPayment);

        const tx = TransactionBuilder.fromXDR(
          signedTransaction.signedTxXdr,
          Networks.PUBLIC,
        );

        const response = await stellarServer.submitTransaction(
          tx as Transaction | FeeBumpTransaction,
        );

        if (response.successful) {
          finishSubmission(response.hash);
        } else {
          capture(ROZO_EVENTS.PAYMENT_FAILED, {
            payment_id: attemptId,
            error_message: "payment_unsuccessful",
            source_chain: rozoStellar.chainId,
          });
          setPayState(PayState.RequestFailed);
        }
      } catch (error: any) {
        // Signing rejection must unblock a remounted pending screen immediately.
        clearPaymentAttempt();
        const horizonResultCodes =
          error.response?.data?.extras?.result_codes ?? {};
        const txResultCode = horizonResultCodes.transaction;
        const opResultCodes = horizonResultCodes.operations ?? [];

        const resultCodeMessages: Record<string, string> = {
          tx_insufficient_balance: STELLAR_INSUFFICIENT_XLM_BASE,
          op_underfunded: "Insufficient balance for this operation",
          op_no_trust: "Missing trustline for the destination asset",
          tx_bad_seq: "Transaction sequence error, please try again",
        };

        const mappedMessage =
          resultCodeMessages[txResultCode] ??
          (opResultCodes.length > 0
            ? resultCodeMessages[opResultCodes[0]]
            : undefined);

        let rawCodes: string;
        try {
          rawCodes = JSON.stringify(horizonResultCodes);
        } catch {
          rawCodes = "[unserializable]";
        }

        let errorMessage: string;
        try {
          if (error instanceof Error) {
            errorMessage = error.message;
          } else if (typeof error === "object") {
            errorMessage = JSON.stringify(error);
          } else {
            errorMessage = String(error);
          }
        } catch {
          errorMessage = String(error);
        }

        const fullErrorMessage = mappedMessage
          ? `${mappedMessage} (Horizon: ${rawCodes})`
          : `${errorMessage} (Horizon: ${rawCodes})`;

        // WalletConnect can throw a plain object. Use serialized error text so
        // `{ code: -4, message: "The user rejected this request." }` is handled
        // like an Error with the same message.
        const isRejected = categorizeError(errorMessage) === ErrorType.REJECTED;
        capture(ROZO_EVENTS.PAYMENT_FAILED, {
          payment_id: attemptId,
          error_message: isRejected
            ? "user_rejected"
            : (fullErrorMessage ?? "unknown_error"),
          source_chain: rozoStellar.chainId,
        });
        if (isRejected) {
          setPayState(PayState.RequestCancelled);
        } else {
          // A sequence mismatch is deterministic: discard its stale XDR so any
          // subsequent attempt rebuilds with the account's current sequence.
          if (txResultCode === "tx_bad_seq") {
            setSignedTx(undefined);
          }
          setRoute(ROUTES.ERROR, { error: mappedMessage ?? errorMessage });
        }
      } finally {
        signingRef.current = false;
        paymentAttemptIdRef.current = undefined;
        releasePaymentAttempt(attemptId);
        setIsLoading(false);
      }
    } else {
      if (attemptId) {
        paymentAttemptIdRef.current = undefined;
        clearPaymentAttempt();
      }
      log?.("[PAY STELLAR] Cannot submit transaction - missing requirements");
    }
  };

  useEffect(() => {
    return () => {
      const attemptId = paymentAttemptIdRef.current;
      if (attemptId && !signingRef.current) releasePaymentAttempt(attemptId);
    };
  }, [releasePaymentAttempt]);

  useEffect(() => {
    if (signedTx) {
      submitButtonRef.current?.click();
    }
  }, [signedTx]);

  useEffect(() => {
    if (!pendingPaymentAttemptId && payState === PayState.WaitingForWallet) {
      setPayState(PayState.RequestCancelled);
    }
  }, [pendingPaymentAttemptId, payState]);

  useEffect(() => {
    if (!selectedStellarTokenOption) return;

    const currentState = store.getState();
    const currentOrder = currentState.type !== "idle" ? currentState.order : undefined;
    const orderKey = currentOrder?.externalId ?? String(currentOrder?.id ?? "");
    if (!orderKey || autoTransferOrderRef.current === orderKey) return;
    autoTransferOrderRef.current = orderKey;

    // Give user time to see the UI before opening
    const transferTimeout = setTimeout(
      () => handleTransfer(selectedStellarTokenOption),
      100,
    );
    return () => clearTimeout(transferTimeout);
  }, [selectedStellarTokenOption]);

  useEffect(() => {
    triggerResize();
    setWalletPaymentState(
      payState === PayState.WaitingForConfirmation ||
        payState === PayState.WaitingForWallet
        ? "waiting"
        : payState === PayState.ProcessingPayment
          ? "processing"
          : "idle",
    );
    return () => setWalletPaymentState("idle");
  }, [payState]);

  if (selectedStellarTokenOption == null) {
    return <PageContent></PageContent>;
  }

  if (payState === PayState.WaitingForWallet) {
    return (
      <PageContent>
        <TokenLogoSpinner token={selectedStellarTokenOption.required.token} loading={true} />
        <ModalContent style={{ paddingBottom: 0 }}>
          <ModalBody>
            Confirm payment in your wallet. If no wallet popup appears, open your wallet app.
          </ModalBody>
        </ModalContent>
      </PageContent>
    );
  }

  return (
    <PageContent>
      <button
        ref={submitButtonRef}
        style={{ display: "none" }}
        onClick={handleSubmitTx}
      />
      {selectedStellarTokenOption && (
        <TokenLogoSpinner
          token={selectedStellarTokenOption.required.token}
          loading={isLoading}
        />
      )}
      <ModalContent style={{ paddingBottom: 0 }}>
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
            ...selectedStellarTokenOption,
            fees: {
              ...selectedStellarTokenOption.fees,
              usd:
                feeData?.source.fee != null
                  ? Number(feeData.source.fee)
                  : selectedStellarTokenOption.fees.usd,
            },
          }}
          feeData={feeData}
          feeLoading={feeLoading}
        />
        {payState === PayState.WaitingForConfirmation && signedTx && (
          <Button variant="primary" onClick={handleSubmitTx}>
            Open Wallet
          </Button>
        )}
        {payState === PayState.RequestCancelled && (
          <Button
            onClick={
              signedTx
                ? handleSubmitTx
                : () => handleTransfer(selectedStellarTokenOption)
            }
          >
            Retry Payment
          </Button>
        )}
        {payState === PayState.OutcomeUnknown && (
          <>
            <ModalBody>
              We could not confirm whether your wallet sent this payment. Check
              your wallet activity before paying again so you are not charged
              twice.
            </ModalBody>
            <Button onClick={handleContactClick}>Contact Support</Button>
          </>
        )}
        {payState === PayState.PreviousPaymentConfirmed && (
          <>
            <ModalBody>
              An earlier payment from this wallet was confirmed on chain. To
              avoid paying twice, check with the merchant before paying again.
            </ModalBody>
            <Button onClick={handleContactClick}>Contact Support</Button>
            <Button
              onClick={() => {
                // Explicit user acknowledgement: start an independent payment.
                const txHash = previousConfirmedTxRef.current;
                if (stellarPublicKey && txHash) {
                  clearPendingStellarSubmission(stellarPublicKey, txHash);
                }
                previousConfirmedTxRef.current = undefined;
                setTxURL(undefined);
                handleTransfer(selectedStellarTokenOption);
              }}
            >
              Pay Again Anyway
            </Button>
          </>
        )}
        {payState === PayState.RequestFailed && (
          <>
            <Button
              onClick={
                signedTx
                  ? handleSubmitTx
                  : () => handleTransfer(selectedStellarTokenOption)
              }
            >
              Retry Payment
            </Button>
            <Button onClick={handleContactClick}>Contact Support</Button>
          </>
        )}
      </ModalContent>
    </PageContent>
  );
};

export default PayWithStellarToken;
