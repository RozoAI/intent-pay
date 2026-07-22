import { ExternalPaymentOptionsString, FeeType, Token, TokenSymbol } from "@rozoai/intent-common";
import { ReactElement } from "react";
import { Address } from "viem";
import { CustomTheme, Mode, Theme } from "../../types";
import {
  PaymentBouncedEvent,
  PaymentCompletedEvent,
  PaymentPayoutCompletedEvent,
  PaymentStartedEvent,
} from "@rozoai/intent-common";

/** Payment props for RozoPayCard — supports both payId and appId modes */
type RozoPayCardPaymentProps =
  | {
      /** The payment ID, generated via the Rozo Pay API */
      payId: string;
      /** Payment options. By default, all are enabled. */
      paymentOptions?: ExternalPaymentOptionsString[];
    }
  | {
      /** Your public app ID */
      appId: string;
      /** Destination chain ID */
      toChain: number;
      /** The destination address */
      toAddress: string;
      /** The destination token */
      toToken: string;
      /** The amount of destination token to send */
      toUnits?: string;
      /** The intent verb */
      intent?: string;
      /** Payment options */
      paymentOptions?: ExternalPaymentOptionsString[];
      /** Preferred chain IDs */
      preferredChains?: number[];
      /** Preferred tokens */
      preferredTokens?: Token[];
      /** Preferred token symbols */
      preferredSymbol?: TokenSymbol[];
      /** External ID */
      externalId?: string;
      /** Developer metadata */
      metadata?: Record<string, any>;
      /** Fee type */
      feeType?: FeeType;
      /** Receiver memo for Stellar/Solana */
      receiverMemo?: string;
    };

/** Card-specific props for RozoPayCard */
export type RozoPayCardProps = RozoPayCardPaymentProps & {
  /** Called when user sends payment and transaction is seen on chain */
  onPaymentStarted?: (event: PaymentStartedEvent) => void;
  /** Called when destination transfer or call completes successfully */
  onPaymentCompleted?: (event: PaymentCompletedEvent) => void;
  /** Called when destination call reverts and funds are refunded */
  onPaymentBounced?: (event: PaymentBouncedEvent) => void;
  /** Called when payout completes */
  onPayoutCompleted?: (event: PaymentPayoutCompletedEvent) => void;
  /** Called when the card is opened/mounted */
  onOpen?: () => void;
  /** Called when the card is closed/unmounted */
  onClose?: () => void;
  /** Card width. Default: 480px */
  width?: number | string;
  /** Card height. Default: auto */
  height?: number | string;
  /** CSS class name for the card wrapper */
  className?: string;
  /** Inline styles for the card wrapper */
  style?: React.CSSProperties;
};

/** Render props for RozoPayCard.Custom */
export type RozoPayCardCustomProps = RozoPayCardPaymentProps & {
  /** Custom renderer */
  children: (renderProps: {
    show: () => void;
    hide: () => void;
  }) => ReactElement;
};

/** Card state for internal state machine */
export type CardState =
  | "loading"           // Initial: fetching payment details
  | "select_method"     // STATE 1: wallet selection
  | "select_token"      // STATE 2: token selection
  | "confirmation"      // STATE 3: payment confirmation
  | "completed"         // STATE 4: payment success
  | "error";            // Error state
