import { useCallback, useEffect, useMemo, useRef } from "react";

import { usePayContext } from "../../hooks/usePayContext";
import { TextContainer } from "./styles";

import {
  assertNotNull,
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
  writeRozoPayOrderID,
} from "@rozoai/intent-common";
import { AnimatePresence, Variants } from "framer-motion";
import { getAddress } from "viem";
import { ROUTES } from "../../constants/routes";
import { useRozoPay } from "../../hooks/useDaimoPay";
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
        feeType,
        externalId,
        metadata,
        showProcessingPayout,
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
        evmChains: undefined,
        externalId,
        metadata,
        showProcessingPayout,
        feeType,
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
        const isSolana = isSolanaChain(toChain);
        const isStellar = isStellarChain(toChain);

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
  const {
    order,
    paymentState: payState,
    rozoPaymentId,
    paymentRozoCompleted,
    payoutRozoCompleted,
  } = useRozoPay();

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

  // Payment events: call these three event handlers.
  const {
    onPaymentStarted,
    onPaymentCompleted,
    onPaymentBounced,
    onPayoutCompleted,
  } = props;

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

  // Track sent flags for payment events
  const sentStart = useRef(false);
  const sentComplete = useRef(false);
  const sentPayoutComplete = useRef(false);

  // Reset the sent flags when order changes to allow events to be fired again
  useEffect(() => {
    sentStart.current = false;
    sentComplete.current = false;
    sentPayoutComplete.current = false;
  }, [order?.id]);

  // Emit onPaymentStart handler when payment state changes to payment_started
  useEffect(() => {
    const currentRozoPaymentId = rozoPaymentId ?? order?.externalId ?? null;
    if (sentStart.current) return;
    if (payState !== "payment_started") return;

    sentStart.current = true;
    const event: PaymentStartedEvent = {
      type: RozoPayEventType.PaymentStarted,
      paymentId: currentRozoPaymentId || writeRozoPayOrderID(order.id),
      chainId: order.destFinalCallTokenAmount.token.chainId,
      txHash: null,
      payment: getRozoPayOrderView(order),
    };

    onPaymentStarted?.(event);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, payState, rozoPaymentId, order?.externalId]);

  // Type guard to check if order is hydrated
  const isHydratedOrder = (
    order: any
  ): order is RozoPayHydratedOrderWithOrg => {
    return order && typeof order === "object" && "intentAddr" in order;
  };

  // Helper function to safely extract transaction hash from order
  const getDestinationTxHash = (order: any): string | null => {
    // Only proceed if order is hydrated (where tx hashes would exist)
    if (!isHydratedOrder(order)) {
      return null;
    }

    // Check for destFastFinishTxHash first (preferred)
    if ("destFastFinishTxHash" in order && order.destFastFinishTxHash) {
      return order.destFastFinishTxHash;
    }
    // Fallback to destClaimTxHash
    if ("destClaimTxHash" in order && order.destClaimTxHash) {
      return order.destClaimTxHash;
    }
    return null;
  };

  const getPayoutTxHash = (
    order: RozoPayHydratedOrderWithOrg
  ): string | null => {
    if (!isHydratedOrder(order)) {
      return null;
    }
    if ("payoutTransactionHash" in order && order.payoutTransactionHash) {
      return order.payoutTransactionHash;
    }
    return null;
  };

  // Emit onPaymentComplete or onPaymentBounced handler when payment state
  // changes to payment_completed or payment_bounced
  const lastRozoPaymentId = useRef<string | null>(null);

  useEffect(() => {
    // Reset sentComplete flags when rozoPaymentId changes
    const currentRozoPaymentId = rozoPaymentId ?? order?.externalId;
    if (currentRozoPaymentId !== lastRozoPaymentId.current) {
      sentComplete.current = false;
      sentPayoutComplete.current = false;
      lastRozoPaymentId.current = currentRozoPaymentId || null;
    }

    if (!order) return;

    // Check if payment is completed (either through payState or paymentRozoCompleted)
    const isPaymentCompleted =
      payState === "payment_completed" || paymentRozoCompleted;
    const isPaymentBounced = payState === "payment_bounced";
    const isPayoutCompleted =
      payState === "payout_completed" || payoutRozoCompleted;

    // Handle payout completion separately (can happen after payment completion)
    if (isPayoutCompleted && !sentPayoutComplete.current) {
      sentPayoutComplete.current = true;

      const sourceChain = order.destFinalCallTokenAmount.token.chainId;
      const destChain = isToStellar
        ? rozoStellar.chainId
        : isToSolana
        ? rozoSolana.chainId
        : payParams?.toChain ?? order.destFinalCallTokenAmount.token.chainId;

      const payoutEvent: PaymentPayoutCompletedEvent = {
        type: RozoPayEventType.PaymentPayoutCompleted,
        paymentId: order.externalId || writeRozoPayOrderID(order.id),
        paymentTx: {
          hash: assertNotNull(
            getDestinationTxHash(order),
            `Payment tx hash null on order ${order.id} when intent status is ${order.intentStatus}`
          ),
          chainId: sourceChain,
          url: assertNotNull(
            getChainExplorerTxUrl(
              sourceChain,
              assertNotNull(
                getDestinationTxHash(order),
                `Payment tx hash null on order ${order.id} when intent status is ${order.intentStatus}`
              )
            ),
            `Payment tx url null on order ${order.id} when intent status is ${order.intentStatus}`
          ),
        },
        payoutTx: {
          hash: assertNotNull(
            getPayoutTxHash(order as RozoPayHydratedOrderWithOrg),
            `Payout tx hash null on order ${order.id} when intent status is ${order.intentStatus}`
          ),
          chainId: destChain,
          url: assertNotNull(
            getChainExplorerTxUrl(
              destChain,
              assertNotNull(
                getPayoutTxHash(order as RozoPayHydratedOrderWithOrg),
                `Payout tx hash null on order ${order.id} when intent status is ${order.intentStatus}`
              )
            ),
            `Payout tx url null on order ${order.id} when intent status is ${order.intentStatus}`
          ),
        },
        payment: getRozoPayOrderView(order),
      };
      onPayoutCompleted?.(payoutEvent);
    }

    // Handle payment completion/bounced (only if not already sent)
    if (sentComplete.current) return;
    if (!isPaymentCompleted && !isPaymentBounced) return;

    sentComplete.current = true;
    const eventType = isPaymentCompleted
      ? RozoPayEventType.PaymentCompleted
      : RozoPayEventType.PaymentBounced;

    const event = {
      type: eventType,
      paymentId: order.externalId || writeRozoPayOrderID(order.id),
      chainId: order.destFinalCallTokenAmount.token.chainId,
      txHash: assertNotNull(
        getDestinationTxHash(order),
        `[PAY BUTTON] dest tx hash null on order ${order.id} when intent status is ${order.intentStatus}`
      ),
      payment: getRozoPayOrderView(order),
      rozoPaymentId: currentRozoPaymentId,
    };

    log("[PAY BUTTON] Event", {
      order,
      event,
      isPaymentCompleted,
    });

    if (isPaymentCompleted) {
      onPaymentCompleted?.(event as PaymentCompletedEvent);
    } else if (isPaymentBounced) {
      onPaymentBounced?.(event as PaymentBouncedEvent);
    }
  }, [
    order,
    payState,
    paymentRozoCompleted,
    payoutRozoCompleted,
    rozoPaymentId,
  ]);

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
