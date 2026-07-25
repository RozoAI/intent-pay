import {
  ApiVersion,
  baseEURC,
  baseUSDC,
  CreateNewPaymentParams,
  FeeType,
  generateIntentTitle,
  getKnownToken,
  getOrderDestChainId,
  mergedMetadata,
  RozoPayHydratedOrderWithOrg,
  RozoPayOrderWithOrg,
  rozoSolana,
  rozoStellar,
  rozoStellarEURC,
  rozoStellarUSDC,
  Token,
  TokenSymbol,
  WalletPaymentOption,
} from "@rozoai/intent-common";
import { formatUnits, parseUnits } from "viem";
import { DEFAULT_ROZO_APP_ID } from "../constants/rozoConfig";
import { convertPreferredSymbolsToTokens } from "../utils/token";
import { PayParams } from "./paymentFsm";

/**
 * Round a decimal amount string to `decimals` fraction digits, string-only
 * (no `Number()` round-trip), so large-magnitude amounts don't lose
 * precision before being scaled to atomic units via `parseUnits`.
 */
function roundDecimalString(value: string, decimals: number): string {
  const [wholeRaw, fracRaw = ""] = value.split(".");
  const whole = wholeRaw || "0";
  if (fracRaw.length <= decimals) {
    return decimals === 0 ? whole : `${whole}.${fracRaw.padEnd(decimals, "0")}`;
  }

  const kept = fracRaw.slice(0, decimals);
  const roundUp = fracRaw.charCodeAt(decimals) >= "5".charCodeAt(0);
  if (!roundUp) {
    return decimals === 0 ? whole : `${whole}.${kept}`;
  }

  // Propagate the carry through `whole.kept` as a single integer string.
  const digits = (whole + kept).split("");
  let i = digits.length - 1;
  while (i >= 0) {
    if (digits[i] === "9") {
      digits[i] = "0";
      i--;
    } else {
      digits[i] = String(Number(digits[i]) + 1);
      break;
    }
  }
  const carried = i < 0 ? "1" + digits.join("") : digits.join("");
  const newWhole = carried.slice(0, carried.length - decimals) || "0";
  const newFrac = carried.slice(carried.length - decimals);
  return decimals === 0 ? newWhole : `${newWhole}.${newFrac}`;
}

type OrderLike = RozoPayHydratedOrderWithOrg | RozoPayOrderWithOrg;

export type CreatePaymentContext = {
  /** Original pay params from the button. */
  payParams: PayParams;
  /** Existing order, if any (used to derive amount/metadata in hydrate flows). */
  order?: OrderLike;
  /** Wallet option the user selected (required for wallet payments). */
  walletOption?: WalletPaymentOption;
  /** Explicit API version (defaults to v2). */
  apiVersion?: ApiVersion;
  /** Override for fee type – falls back to payParams.feeType or ExactIn. */
  feeTypeOverride?: FeeType;
  /**
   * Whether to merge metadata from an existing order into the payment payload.
   * - true: include order metadata (hydrate existing order)
   * - false: only include metadata from payParams (standalone Rozo payment)
   */
  includeOrderMetadata?: boolean;
};

/**
 * Resolve the final destination address from PayParams, handling EVM, Solana
 * and Stellar destinations in a single place.
 */
export function resolveDestinationAddress(payParams: PayParams): string {
  if (payParams.toSolanaAddress && payParams.toSolanaAddress.trim() !== "") {
    return payParams.toSolanaAddress;
  }
  if (payParams.toStellarAddress && payParams.toStellarAddress.trim() !== "") {
    return payParams.toStellarAddress;
  }
  return payParams.toAddress ?? "";
}

/**
 * payId mode has no RozoPayButton props to read preferredTokens from, so
 * source stablecoin filtering must mirror the destination: EURC destination
 * → source restricted to EURC; any other destination → source restricted to
 * USDC/USDT (EURC balances can't fund a USD destination, and vice versa).
 * Non-stablecoin source options (native tokens etc.) are unaffected — this
 * filter only ever narrows within [USDC, USDT, EURC].
 */
export function derivePayIdPreferredTokens(destTokenSymbol: string): {
  preferredSymbol: TokenSymbol[];
  preferredTokens: Token[] | undefined;
} {
  const preferredSymbol =
    destTokenSymbol === TokenSymbol.EURC ? [TokenSymbol.EURC] : [TokenSymbol.USDC, TokenSymbol.USDT];
  return {
    preferredSymbol,
    preferredTokens: convertPreferredSymbolsToTokens(preferredSymbol, undefined),
  };
}

/**
 * Build a CreateNewPaymentParams payload in a single, canonical place.
 *
 * This helper encapsulates:
 * - Destination token/amount resolution from either payParams or an existing order
 * - Preferred payment method (wallet option vs default Base chain)
 * - Address normalization across EVM/Solana/Stellar
 * - FeeType handling (ExactIn / ExactOut)
 */
export function buildCreatePaymentPayload(ctx: CreatePaymentContext): CreateNewPaymentParams {
  const {
    payParams,
    order,
    walletOption,
    apiVersion = "v2",
    feeTypeOverride,
    includeOrderMetadata = false,
  } = ctx;

  const appId = payParams.appId ?? DEFAULT_ROZO_APP_ID;
  const feeType = feeTypeOverride ?? payParams.feeType ?? FeeType.ExactIn;

  // --------------------------------------------------
  // Destination token / amount
  // --------------------------------------------------
  let toChain: number;
  let toTokenAddress: string;
  let rawAmountUnitsStr: string;
  let tokenDecimals: number;

  if (order) {
    toChain = getOrderDestChainId(order);
    toTokenAddress = order.destFinalCallTokenAmount.token.token;

    const token = getKnownToken(toChain, toTokenAddress);
    if (!token) {
      throw new Error(`Token not found for chain ${toChain} and token ${toTokenAddress}`);
    }

    tokenDecimals = token.decimals;
    rawAmountUnitsStr = formatUnits(BigInt(order.destFinalCallTokenAmount.amount), tokenDecimals);
  } else {
    toChain = payParams.toChain;
    toTokenAddress = payParams.toToken;
    const token = getKnownToken(toChain, toTokenAddress);
    tokenDecimals = token?.decimals ?? 18;
    rawAmountUnitsStr = payParams.toUnits ?? "0";
  }

  const rawAmountAtomic = parseUnits(
    roundDecimalString(rawAmountUnitsStr, tokenDecimals),
    tokenDecimals,
  );

  // --------------------------------------------------
  // Preferred payment method (what user will pay with)
  // --------------------------------------------------
  let preferredChain: number;
  let preferredTokenAddress: string;

  if (walletOption) {
    preferredChain = walletOption.required.token.chainId;
    preferredTokenAddress = walletOption.required.token.token;

    // Special-case: Solana wallet should pay into Rozo Solana bridge chain
    if (preferredChain === rozoSolana.chainId) {
      preferredChain = rozoSolana.chainId;
    }
  } else {
    // When no explicit wallet option is given, default preferred chain/token
    // based on whether destination token is USD or non-USD (EURC etc.)
    const destToken = getKnownToken(toChain, toTokenAddress);
    const isNonUSDToken = destToken?.fiatISO !== "USD";

    preferredChain = isNonUSDToken ? baseEURC.chainId : baseUSDC.chainId;
    preferredTokenAddress = isNonUSDToken ? baseEURC.token : baseUSDC.token;
  }

  // --------------------------------------------------
  // Fee handling
  // --------------------------------------------------
  // Fee comes from the wallet quote as a float USD value; it's not the
  // backend-critical amount, so precision only needs to hold to the
  // token's atomic-unit resolution.
  const feeUsd = walletOption?.fees.usd ?? 0;
  const feeAtomic = feeType === FeeType.ExactIn ? 0n : parseUnits(feeUsd.toFixed(tokenDecimals), tokenDecimals);
  const calculatedAtomic = rawAmountAtomic - feeAtomic;

  // Clamp to zero to avoid negative amounts when fees exceed amount
  const safeAtomic = calculatedAtomic < 0n ? 0n : calculatedAtomic;

  // --------------------------------------------------
  // Address & metadata
  // --------------------------------------------------
  const toAddress = resolveDestinationAddress(payParams);

  const isAbleToIncludeReceiverMemo = [rozoSolana.chainId, rozoStellar.chainId].includes(toChain);

  // Title is for display only — use metadata.intent if set, otherwise generate.
  // payParams.intent is reserved for the top-level API field (e.g. "stellar_direct").
  const title =
    payParams.metadata?.intent ??
    generateIntentTitle({
      toChainId: toChain,
      toTokenAddress: toTokenAddress,
      preferredChainId: preferredChain,
      preferredTokenAddress,
    });

  const orderMetadata =
    includeOrderMetadata && order
      ? {
          ...order.metadata,
          ...order.userMetadata,
        }
      : {};

  // --------------------------------------------------
  // Stellar Direct Settlement: auto-detect same-chain USDC→USDC
  // --------------------------------------------------
  // When both source and destination are Stellar USDC, the backend can settle
  // directly (one on-chain transfer, 0 fee, no hub hop). We opt-in by sending
  // intent: "stellar_direct". Consumer can also override via payParams.intent.
  // Both destination and source must be Stellar with the SAME token (USDC or EURC)
  const isStellarSameToken =
    toChain === rozoStellar.chainId &&
    preferredChain === rozoStellar.chainId &&
    toTokenAddress.toLowerCase() === preferredTokenAddress.toLowerCase();
  const isSupportedStellarToken =
    toTokenAddress.toLowerCase() === rozoStellarUSDC.token.toLowerCase() ||
    toTokenAddress.toLowerCase() === rozoStellarEURC.token.toLowerCase();
  const isStellarDirect = isStellarSameToken && isSupportedStellarToken;

  // When isStellarDirect, always force intent to "stellar_direct" regardless of consumer override
  const intent = isStellarDirect ? "stellar_direct" : payParams.intent;

  const payload: CreateNewPaymentParams = {
    apiVersion,
    title,
    feeType,
    appId,
    toChain,
    toToken: toTokenAddress,
    toAddress,
    preferredChain,
    preferredTokenAddress,
    toUnits: formatUnits(safeAtomic, tokenDecimals),
    ...(isAbleToIncludeReceiverMemo && payParams.receiverMemo
      ? { receiverMemo: payParams.receiverMemo }
      : {}),
    description: payParams.metadata?.description ?? "",
    metadata: mergedMetadata({
      ...orderMetadata,
      ...payParams.metadata,
    }),
    ...(intent ? { intent } : {}),
  };

  return payload;
}
