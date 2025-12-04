import {
  ExternalPaymentOptionsString,
  FeeType,
  PaymentBouncedEvent,
  PaymentCompletedEvent,
  PaymentPayoutCompletedEvent,
  PaymentStartedEvent,
  RozoPayUserMetadata,
} from "@rozoai/intent-common";
import { ReactElement } from "react";
import { Address } from "viem";
import { CustomTheme, Mode, Theme } from "../../types";

/** Chain-specific props for EVM chains (Base, Ethereum, Polygon) */
type EvmChainProps = {
  /**
   * The destination address to transfer to, or contract to call.
   * Must be a valid EVM address in 0x... format.
   */
  toAddress: Address;
  /**
   * The destination token to send, completing payment.
   * Must be an ERC-20 token address or the zero address (0x0000000000000000000000000000000000000000)
   * for native token (ETH, MATIC, etc).
   */
  toToken: Address;
  /**
   * Optional calldata to call an arbitrary function on `toAddress`.
   */
  // toCallData?: Hex;
  /**
   * The address to refund to if the payment bounces.
   */
  // refundAddress?: Address;
};

/** Chain-specific props for non-EVM chains (Solana, Stellar) */
type NonEvmChainProps = {
  /**
   * The destination address to transfer to.
   * - For Solana (900): Base58 encoded address (32-44 characters)
   * - For Stellar (1500): Account address starting with 'G' (56 characters)
   */
  toAddress: string;
  /**
   * The destination token to send, completing payment.
   * - For Solana: Token mint address or "native" for SOL
   * - For Stellar: Asset code (e.g., "USDC", "XLM") or "native"
   */
  toToken: string;
};

/** Common props shared by all chain types */
type CommonPaymentProps = {
  /**
   * Your public app ID. Specify either (payId) or (appId + parameters).
   */
  appId: string;
  /**
   * Destination chain ID for non-EVM chains.
   *
   * @see {@link https://docs.rozo.ai/integration/api-doc/supported-tokens-and-chains#pay-out-tokens-and-chains}
   */
  toChain: number;
  /**
   * The amount of destination token to send (transfer or approve).
   * If not provided, the user will be prompted to enter an amount.
   */
  toUnits?: string;
  /**
   * The intent verb, such as "Pay", "Deposit", or "Purchase".
   */
  intent?: string;
  /**
   * The memo to use for the payment.
   */
  receiverMemo?: string;
  /**
   * The fee type to use for the payment.
   * - exactIn (default): Fee deducted from input, recipient receives amount - fee
   * - exactOut: Fee added to input, recipient receives exact amount
   */
  feeType?: FeeType;
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
  preferredTokens?: { chain: number; address: Address | string }[];
  /**
   * Only allow payments on these EVM chains.
   */
  // evmChains?: number[];
  /**
   * External ID. E.g. a correlation ID.
   */
  externalId?: string;
  /**
   * Developer metadata. E.g. correlation ID.
   */
  metadata?: RozoPayUserMetadata;
};

/** Props for RozoPayButton - discriminated union based on chain type */
export type PayButtonPaymentProps =
  | (CommonPaymentProps & EvmChainProps)
  | (CommonPaymentProps & NonEvmChainProps)
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
  /** Called when payout completes */
  onPayoutCompleted?: (event: PaymentPayoutCompletedEvent) => void;
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
  // redirectReturnUrl?: string;
  /** Optional configuration to show processing pay out loading when payment completed */
  showProcessingPayout?: boolean;
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
