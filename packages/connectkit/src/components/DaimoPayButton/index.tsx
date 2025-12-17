import { useCallback, useEffect, useMemo, useRef } from "react";

import { usePayContext } from "../../hooks/usePayContext";
import { TextContainer } from "./styles";

import {
  getChainExplorerTxUrl,
  getRozoPayOrderView,
  PaymentBouncedEvent,
  PaymentCompletedEvent,
  PaymentPayoutCompletedEvent,
  PaymentStartedEvent,
  RozoPayEventType,
  RozoPayHydratedOrderWithOrg,
  rozoSolana,
  rozoStellar,
  TokenSymbol,
  writeRozoPayOrderID,
} from "@rozoai/intent-common";
import { AnimatePresence, Variants } from "framer-motion";
import { getAddress } from "viem";
import { ROUTES } from "../../constants/routes";
import { useRozoPay } from "../../hooks/useDaimoPay";
import { paymentEventEmitter } from "../../payment/paymentEventEmitter";
import { PayParams } from "../../payment/paymentFsm";
import { ResetContainer } from "../../styles";
import {
  getChainTypeName,
  isEvmChain,
  isSolanaChain,
  isStellarChain,
  validateAddressForChain,
} from "../../types/chainAddress";
import { validatePayoutToken } from "../../utils/validatePayoutToken";
import ThemedButton, { ThemeContainer } from "../Common/ThemedButton";
import { RozoPayButtonCustomProps, RozoPayButtonProps } from "./types";

/**
 * A button that shows the Rozo Pay checkout. Replaces the traditional
 * Connect Wallet » approve » execute sequence with a single action.
 */
export function RozoPayButton(props: RozoPayButtonProps): JSX.Element {
  const { theme, mode, customTheme } = props;
  const context = usePayContext();

  return (
    <RozoPayButtonCustom {...props}>
      {({ show }) => (
        <ResetContainer
          $useTheme={theme ?? context.theme}
          $useMode={mode ?? context.mode}
          $customTheme={customTheme ?? context.customTheme}
        >
          <ThemeContainer onClick={props.disabled ? undefined : show}>
            <ThemedButton
              theme={theme ?? context.theme}
              mode={mode ?? context.mode}
              customTheme={customTheme ?? context.customTheme}
            >
              <RozoPayButtonInner />
            </ThemedButton>
          </ThemeContainer>
        </ResetContainer>
      )}
    </RozoPayButtonCustom>
  );
}

/** Like RozoPayButton, but with custom styling. */
function RozoPayButtonCustom(props: RozoPayButtonCustomProps): JSX.Element {
  const context = usePayContext();

  // Memoize payParams/payId with proper dependency tracking
  // For object/array props, we serialize them to detect deep changes
  const { payParams, payId } = useMemo(() => {
    // Handle payId mode
    if ("payId" in props) {
      return { payParams: null, payId: props.payId };
    }

    // Handle appId mode
    if ("appId" in props) {
      const isEvm = isEvmChain(props.toChain);
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
        showProcessingPayout,
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
        preferredSymbol: preferredSymbol ?? [
          TokenSymbol.USDC,
          TokenSymbol.USDT,
        ], // Default to USDC and USDT
        evmChains: undefined,
        externalId,
        metadata,
        showProcessingPayout,
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
        // Non-EVM: Route to appropriate address field
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
  }, [
    // Serialize entire props to catch all changes (simple and safe)
    JSON.stringify(props),
  ]);

  const { paymentState, log } = context;
  const { order, paymentState: payState, rozoPaymentId } = useRozoPay();

  const isToStellar = useMemo(() => {
    if (!payParams) return false;
    return isStellarChain(payParams.toChain);
  }, [payParams?.toChain]);

  const isToSolana = useMemo(() => {
    if (!payParams) return false;
    return isSolanaChain(payParams.toChain);
  }, [payParams?.toChain]);

  // Store validation error ref
  const validationErrorRef = useRef<any>(null);

  // Validate address format matches chain type and chain/token support
  useEffect(() => {
    if ("appId" in props && props.toAddress) {
      const isValid = validateAddressForChain(props.toChain, props.toAddress);

      if (!isValid) {
        const chainName = getChainTypeName(props.toChain);
        console.error(
          `[RozoPayButton] Invalid address format for ${chainName} (chain ${props.toChain}). ` +
            `Received: ${props.toAddress}. ` +
            `Expected format: ${
              isEvmChain(props.toChain)
                ? "0x... (EVM address)"
                : isSolanaChain(props.toChain)
                ? "Base58 encoded address (32-44 chars)"
                : "G... (Stellar address, 56 chars)"
            }`
        );
      }

      // Validate chain and token support for payouts
      const validationError = validatePayoutToken(props.toChain, props.toToken);

      if (validationError) {
        console.error(
          `[RozoPayButton] Validation error: ${validationError.message}`
        );
        validationErrorRef.current = validationError;
      } else {
        validationErrorRef.current = null;
      }
    }
  }, [props]);

  // Track previous values to prevent unnecessary API calls
  const prevPayIdRef = useRef<string | null>(null);
  const prevPayParamsRef = useRef<PayParams | null>(null);

  // Set the payId or payParams when they change
  useEffect(() => {
    const payIdChanged = payId !== prevPayIdRef.current;
    const payParamsChanged = payParams !== prevPayParamsRef.current;

    if (payIdChanged && payId != null) {
      prevPayIdRef.current = payId;
      prevPayParamsRef.current = null; // Reset when switching modes
      paymentState.setPayId(payId);
    } else if (payParamsChanged && payParams != null) {
      prevPayParamsRef.current = payParams;
      prevPayIdRef.current = null; // Reset when switching modes
      paymentState.setPayParams(payParams);
    }
    // Note: paymentState is not stable/memoized, so we don't include it as a dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payId, payParams]);

  // Set the confirmation message
  const { setConfirmationMessage } = context;
  useEffect(() => {
    if (props.confirmationMessage) {
      setConfirmationMessage(props.confirmationMessage);
    }
  }, [props.confirmationMessage, setConfirmationMessage]);

  // Set the redirect return url
  const { setRedirectReturnUrl } = context;
  useEffect(() => {
    if ("redirectReturnUrl" in props && props.redirectReturnUrl) {
      setRedirectReturnUrl(props.redirectReturnUrl as string);
    }
  }, [props]);

  // Set the onOpen and onClose callbacks
  const { setOnOpen, setOnClose } = context;
  useEffect(() => {
    setOnOpen(props.onOpen);
    return () => setOnOpen(undefined);
  }, [props.onOpen, setOnOpen]);

  useEffect(() => {
    setOnClose(props.onClose);
    return () => setOnClose(undefined);
  }, [props.onClose, setOnClose]);

  // Functions to show and hide the modal
  const { children, closeOnSuccess, resetOnSuccess, connectedWalletOnly } =
    props;
  const show = useCallback(() => {
    // Check for validation errors before showing payment
    if (validationErrorRef.current) {
      context.log(
        "[RozoPayButton] Validation error detected, showing error page",
        validationErrorRef.current
      );
      context.setOpen(true);
      context.setRoute(ROUTES.ERROR, {
        validationError: validationErrorRef.current,
      });
      return;
    }

    const modalOptions = {
      closeOnSuccess,
      resetOnSuccess,
      connectedWalletOnly,
    };
    context.showPayment(modalOptions);
  }, [connectedWalletOnly, closeOnSuccess, resetOnSuccess, context]);
  const hide = useCallback(() => context.setOpen(false), [context]);

  // Type guard to check if order is hydrated
  const isHydratedOrder = (
    order: any
  ): order is RozoPayHydratedOrderWithOrg => {
    return order && typeof order === "object" && "intentAddr" in order;
  };

  // Helper function to safely extract transaction hash from order
  const getSourceTxHash = (order: any): string | null => {
    // Only proceed if order is hydrated (where tx hashes would exist)
    if (!isHydratedOrder(order)) {
      return null;
    }

    if ("sourceStartTxHash" in order && order.sourceStartTxHash) {
      return order.sourceStartTxHash as string;
    }

    if ("payinTransactionHash" in order && order.payinTransactionHash) {
      return order.payinTransactionHash as string;
    }

    if (
      "source" in order &&
      order.source &&
      typeof order.source === "object" &&
      "txHash" in order.source &&
      order.source.txHash !== null &&
      typeof order.source.txHash === "string"
    ) {
      return order.source.txHash as string;
    }

    return null;
  };

  const getDestinationTxHash = (
    order: RozoPayHydratedOrderWithOrg
  ): string | null => {
    if (!isHydratedOrder(order)) {
      return null;
    }

    if ("payoutTransactionHash" in order && order.payoutTransactionHash) {
      return order.payoutTransactionHash;
    }

    if (
      "destination" in order &&
      order.destination &&
      typeof order.destination === "object" &&
      "txHash" in order.destination &&
      order.destination.txHash !== null &&
      typeof order.destination.txHash === "string"
    ) {
      return order.destination.txHash as string;
    }

    return null;
  };

  const orderIdString = useMemo(() => {
    return order?.externalId
      ? order.externalId
      : order?.id
      ? String(order.id)
      : null;
  }, [order]);

  // Helper to create event objects
  const createPaymentStartedEvent = useCallback(
    (data: any): PaymentStartedEvent | null => {
      const currentOrder = data?.order || order;
      if (!currentOrder) return null;

      return {
        type: RozoPayEventType.PaymentStarted,
        paymentId: orderIdString || writeRozoPayOrderID(currentOrder.id),
        chainId: currentOrder.destFinalCallTokenAmount.token.chainId,
        txHash: null,
        payment: getRozoPayOrderView(currentOrder),
      };
    },
    [order, orderIdString]
  );

  const createPaymentCompletedEvent = useCallback(
    (data: any): PaymentCompletedEvent | null => {
      const currentOrder = data?.order || order;
      if (!currentOrder) return null;

      // Only create event if order is in completed state and has transaction hash
      const txHash = getSourceTxHash(currentOrder);
      if (!txHash) {
        // Order not ready yet - skip event creation
        return null;
      }

      return {
        type: RozoPayEventType.PaymentCompleted,
        paymentId:
          currentOrder.externalId || writeRozoPayOrderID(currentOrder.id),
        chainId: currentOrder.destFinalCallTokenAmount.token.chainId,
        txHash,
        payment: getRozoPayOrderView(currentOrder),
        rozoPaymentId:
          orderIdString ?? writeRozoPayOrderID(currentOrder.id) ?? null,
      };
    },
    [order, orderIdString]
  );

  const createPaymentBouncedEvent = useCallback(
    (data: any): PaymentBouncedEvent | null => {
      const currentOrder = data?.order || order;
      if (!currentOrder) return null;

      // Only create event if order has transaction hash
      const txHash = getSourceTxHash(currentOrder);
      if (!txHash) {
        // Order not ready yet - skip event creation
        return null;
      }

      return {
        type: RozoPayEventType.PaymentBounced,
        paymentId: orderIdString || writeRozoPayOrderID(currentOrder.id),
        chainId: currentOrder.destFinalCallTokenAmount.token.chainId,
        txHash,
        payment: getRozoPayOrderView(currentOrder),
        rozoPaymentId:
          orderIdString ?? writeRozoPayOrderID(currentOrder.id) ?? null,
      };
    },
    [order, orderIdString]
  );

  const createPayoutCompletedEvent = useCallback(
    (data: any): PaymentPayoutCompletedEvent | null => {
      const currentOrder = data?.order || order;
      if (!currentOrder) return null;

      const sourceChain = currentOrder.destFinalCallTokenAmount.token.chainId;
      const destChain = isToStellar
        ? rozoStellar.chainId
        : isToSolana
        ? rozoSolana.chainId
        : payParams?.toChain ?? sourceChain;

      // Only create event if both transaction hashes are available
      const paymentTxHash = getSourceTxHash(currentOrder);
      const payoutTxHash = getDestinationTxHash(
        currentOrder as RozoPayHydratedOrderWithOrg
      );

      if (!paymentTxHash || !payoutTxHash) {
        // Order not ready yet - skip event creation
        return null;
      }

      return {
        type: RozoPayEventType.PaymentPayoutCompleted,
        paymentId:
          currentOrder.externalId || writeRozoPayOrderID(currentOrder.id),
        paymentTx: {
          hash: paymentTxHash,
          chainId: sourceChain,
          url: getChainExplorerTxUrl(sourceChain, paymentTxHash) || "",
        },
        payoutTx: {
          hash: payoutTxHash,
          chainId: destChain,
          url: getChainExplorerTxUrl(destChain, payoutTxHash) || "",
        },
        payment: getRozoPayOrderView(currentOrder),
        rozoPaymentId:
          orderIdString ?? writeRozoPayOrderID(currentOrder.id) ?? null,
      };
    },
    [order, isToStellar, isToSolana, payParams?.toChain, orderIdString]
  );

  // Payment events: call these three event handlers.
  const {
    onPaymentStarted,
    onPaymentCompleted,
    onPaymentBounced,
    onPayoutCompleted,
  } = props;

  // Subscribe to payment events using Event Emitter Pattern
  // This works reliably in both workspace and built packages
  useEffect(() => {
    if (!orderIdString || !order) {
      return;
    }

    // Subscribe to all payment events
    const unsubscribers = [
      paymentEventEmitter.subscribe("payment_started", (data: any) => {
        if (data.order?.externalId === orderIdString) {
          const event = createPaymentStartedEvent(data);
          if (event !== null) {
            log("[PAY BUTTON] Payment Started Event", { order, event });
            onPaymentStarted?.(event);
          }
        }
      }),

      paymentEventEmitter.subscribe("payment_completed", (data: any) => {
        if (data.order?.externalId === orderIdString) {
          const event = createPaymentCompletedEvent(data);
          if (event !== null) {
            log("[PAY BUTTON] Payment Completed Event", { order, event });
            onPaymentCompleted?.(event);
          }
        }
      }),

      paymentEventEmitter.subscribe("payment_bounced", (data: any) => {
        if (data.order?.externalId === orderIdString) {
          const event = createPaymentBouncedEvent(data);
          if (event !== null) {
            log("[PAY BUTTON] Payment Bounced Event", { order, event });
            onPaymentBounced?.(event);
          }
        }
      }),

      paymentEventEmitter.subscribe("payout_completed", (data: any) => {
        if (data.order?.externalId === orderIdString) {
          const event = createPayoutCompletedEvent(data);
          if (event !== null) {
            log("[PAY BUTTON] Payment Payout Completed Event", {
              order,
              event,
            });
            onPayoutCompleted?.(event);
          }
        }
      }),
    ];

    // Cleanup: unsubscribe and reset events for this order
    return () => {
      unsubscribers.forEach((unsub) => unsub());
      paymentEventEmitter.reset(orderIdString);
    };
  }, [orderIdString, isToStellar, isToSolana, payParams?.toChain]);

  // Open the modal by default if the defaultOpen prop is true
  const hasAutoOpened = useRef(false);
  useEffect(() => {
    if (!props.defaultOpen || hasAutoOpened.current) return;
    if (order == null) return;
    show();
    hasAutoOpened.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, props.defaultOpen, hasAutoOpened.current]);

  // Validation
  if ((payId == null) == (payParams == null)) {
    throw new Error("Must specify either payId or appId, not both");
  }

  return children({ show, hide });
}

RozoPayButtonCustom.displayName = "RozoPayButton.Custom";

RozoPayButton.Custom = RozoPayButtonCustom;

const contentVariants: Variants = {
  initial: {
    zIndex: 2,
    opacity: 0,
    x: "-100%",
  },
  animate: {
    opacity: 1,
    x: 0.1,
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    zIndex: 1,
    opacity: 0,
    x: "-100%",
    pointerEvents: "none",
    position: "absolute",
    transition: {
      duration: 0.4,
      ease: [0.25, 1, 0.5, 1],
    },
  },
};

export function RozoPayButtonInner() {
  const { order } = useRozoPay();
  const label = order?.metadata?.intent ?? "Pay";

  return (
    <AnimatePresence initial={false}>
      <TextContainer
        initial={"initial"}
        animate={"animate"}
        exit={"exit"}
        variants={contentVariants}
        style={{
          height: 40,
        }}
      >
        {label}
      </TextContainer>
    </AnimatePresence>
  );
}
