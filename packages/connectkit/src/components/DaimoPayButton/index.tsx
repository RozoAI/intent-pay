import { ReactElement, useCallback, useEffect, useRef } from "react";

import { usePayContext } from "../../hooks/usePayContext";
import { TextContainer } from "./styles";

import {
  assertNotNull,
  RozoPayEventType,
  RozoPayOrderView,
  RozoPayUserMetadata,
  ExternalPaymentOptionsString,
  getRozoPayOrderView,
  getOrderDestChainId,
  getOrderSourceChainId,
  PaymentBouncedEvent,
  PaymentCompletedEvent,
  PaymentStartedEvent,
  writeRozoPayOrderID,
} from "@rozoai/intent-common";
import { AnimatePresence, Variants } from "framer-motion";
import { Address, Hex } from "viem";
import { useRozoPay } from "../../hooks/useDaimoPay";
import { PayParams } from "../../payment/paymentFsm";
import { ResetContainer } from "../../styles";
import { CustomTheme, Mode, Theme } from "../../types";
import ThemedButton, { ThemeContainer } from "../Common/ThemedButton";

/** Payment details and status. */
export type RozoPayment = RozoPayOrderView;

/** Props for RozoPayButton. */
export type PayButtonPaymentProps =
  | {
      /**
       * Your public app ID. Specify either (payId) or (appId + parameters).
       */
      appId: string;
      /**
       * Destination chain ID.
       */
      toChain: number;
      /**
       * The destination token to send, completing payment. Must be an ERC-20
       * token or the zero address, indicating the native token / ETH.
       */
      toToken: Address;
      /**
       * The amount of destination token to send (transfer or approve).
       * If not provided, the user will be prompted to enter an amount.
       */
      toUnits?: string;
      /**
       * The destination address to transfer to, or contract to call.
       */
      toAddress: Address;
      /**
       * The destination stellar address to transfer to.
       */
      toStellarAddress?: string;
      /**
       * Optional calldata to call an arbitrary function on `toAddress`.
       */
      toCallData?: Hex;
      /**
       * The intent verb, such as "Pay", "Deposit", or "Purchase".
       */
      intent?: string;
      /**
       * Payment options. By default, all are enabled.
       */
      paymentOptions?: ExternalPaymentOptionsString[];
      /**
       * Preferred chain IDs. Assets on these chains will appear first.
       */
      preferredChains?: number[];
      /**
       * Preferred tokens. These appear first in the token list.
       */
      preferredTokens?: { chain: number; address: Address }[];
      /**
       * Only allow payments on these EVM chains.
       */
      evmChains?: number[];
      /**
       * External ID. E.g. a correlation ID.
       */
      externalId?: string;
      /**
       * Developer metadata. E.g. correlation ID.
       * */
      metadata?: RozoPayUserMetadata;
      /**
       * The address to refund to if the payment bounces.
       */
      refundAddress?: Address;
    }
  | {
      /** The payment ID, generated via the Rozo Pay API. Replaces params above. */
      payId: string;
      /** Payment options. By default, all are enabled. */
      paymentOptions?: ExternalPaymentOptionsString[];
    };

type PayButtonCommonProps = PayButtonPaymentProps & {
  /** Called when user sends payment and transaction is seen on chain */
  onPaymentStarted?: (event: PaymentStartedEvent) => void;
  /** Called when destination transfer or call completes successfully */
  onPaymentCompleted?: (event: PaymentCompletedEvent) => void;
  /** Called when destination call reverts and funds are refunded */
  onPaymentBounced?: (event: PaymentBouncedEvent) => void;
  /** Called when the modal is opened. */
  onOpen?: () => void;
  /** Called when the modal is closed. */
  onClose?: () => void;
  /** Open the modal by default. */
  defaultOpen?: boolean;
  /** Automatically close the modal after a successful payment. */
  closeOnSuccess?: boolean;
  /** Reset the payment after a successful payment. */
  resetOnSuccess?: boolean;
  /** Go directly to tokens in already-connected Ethereum and Solana wallet(s).
   * Don't let the user pick any other payment method. Used in embedded flows.*/
  connectedWalletOnly?: boolean;
  /** Custom message to display on confirmation page. */
  confirmationMessage?: string;
  /** Redirect URL to return to the app. E.g. after Coinbase, Binance, RampNetwork. */
  redirectReturnUrl?: string;
};

export type RozoPayButtonProps = PayButtonCommonProps & {
  /** Light mode, dark mode, or auto. */
  mode?: Mode;
  /** Named theme. See docs for options. */
  theme?: Theme;
  /** Custom theme. See docs for options. */
  customTheme?: CustomTheme;
  /** Disable interaction. */
  disabled?: boolean;
};

export type RozoPayButtonCustomProps = PayButtonCommonProps & {
  /** Custom renderer */
  children: (renderProps: {
    show: () => void;
    hide: () => void;
  }) => ReactElement;
};

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

  // Pre-load payment info in background.
  // Reload when any of the info changes.
  let payParams: PayParams | null =
    "appId" in props
      ? {
          appId: props.appId,
          toChain: props.toChain,
          toAddress: props.toAddress,
          toStellarAddress: props.toStellarAddress,
          toToken: props.toToken,
          toUnits: props.toUnits,
          toCallData: props.toCallData,
          intent: props.intent,
          paymentOptions: props.paymentOptions,
          preferredChains: props.preferredChains,
          preferredTokens: props.preferredTokens,
          evmChains: props.evmChains,
          externalId: props.externalId,
          metadata: props.metadata,
          refundAddress: props.refundAddress,
        }
      : null;
  let payId = "payId" in props ? props.payId : null;

  const { paymentState, log } = context;
  const {
    order,
    paymentState: payState,
    rozoPaymentId,
    paymentRozoCompleted,
  } = useRozoPay();

  // Set the payId or payParams
  useEffect(() => {
    if (payId != null) {
      paymentState.setPayId(payId);
    } else if (payParams != null) {
      paymentState.setPayParams(payParams);
    }
    paymentState.setButtonProps(props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payId, JSON.stringify(payParams || {})]);

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
    if (props.redirectReturnUrl) {
      setRedirectReturnUrl(props.redirectReturnUrl);
    }
  }, [props.redirectReturnUrl, setRedirectReturnUrl]);

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
  const { onPaymentStarted, onPaymentCompleted, onPaymentBounced } = props;

  // Functions to show and hide the modal
  const { children, closeOnSuccess, resetOnSuccess, connectedWalletOnly } =
    props;
  const show = useCallback(() => {
    const modalOptions = {
      closeOnSuccess,
      resetOnSuccess,
      connectedWalletOnly,
    };
    context.showPayment(modalOptions);
  }, [connectedWalletOnly, closeOnSuccess, resetOnSuccess, context]);
  const hide = useCallback(() => context.setOpen(false), [context]);

  // Reset the sent flags when order changes to allow events to be fired again
  useEffect(() => {
    sentStart.current = false;
    sentComplete.current = false;
  }, [order?.id]);

  // Emit onPaymentStart handler when payment state changes to payment_started
  const sentStart = useRef(false);
  useEffect(() => {
    if (sentStart.current) return;
    if (payState !== "payment_started") return;

    // TODO: Populate source payment details immediately when the user pays.
    // Use this hack because source chain id is not immediately populated when
    // payment_started
    const sourceChainId = getOrderSourceChainId(order);
    if (sourceChainId == null) return;

    sentStart.current = true;
    onPaymentStarted?.({
      type: RozoPayEventType.PaymentStarted,
      paymentId: writeRozoPayOrderID(order.id),
      chainId: sourceChainId,
      txHash: order.sourceInitiateTxHash,
      payment: getRozoPayOrderView(order),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, payState]);

  // Emit onPaymentComplete or onPaymentBounced handler when payment state
  // changes to payment_completed or payment_bounced
  const sentComplete = useRef(false);
  useEffect(() => {
    console.log({ paymentRozoCompleted, order, rozoPaymentId });
    if (sentComplete.current) return;

    if (!paymentRozoCompleted) {
      if (payState !== "payment_completed" && payState !== "payment_bounced")
        return;
    }

    if (!order) return;

    sentComplete.current = true;
    const eventType =
      payState === "payment_completed"
        ? RozoPayEventType.PaymentCompleted
        : RozoPayEventType.PaymentBounced;
    const event = {
      type: eventType,
      paymentId: writeRozoPayOrderID(order.id),
      chainId: getOrderDestChainId(order),
      txHash: assertNotNull(
        (order as any)?.destFastFinishTxHash ?? (order as any)?.destClaimTxHash,
        `[PAY BUTTON] dest tx hash null on order ${order.id} when intent status is ${order.intentStatus}`
      ),
      payment: getRozoPayOrderView(order),
      rozoPaymentId: rozoPaymentId ?? order.externalId,
    };

    if (payState === "payment_completed" || paymentRozoCompleted) {
      onPaymentCompleted?.(event as PaymentCompletedEvent);
    } else if (payState === "payment_bounced") {
      onPaymentBounced?.(event as PaymentBouncedEvent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, payState, paymentRozoCompleted]);

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
