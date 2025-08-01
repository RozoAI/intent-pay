import {
  assert,
  RozoPayOrderMode,
  RozoPayOrderWithOrg,
  getOrderDestChainId,
  readRozoPayOrderID,
  stellar,
  base,
  baseUSDC,
} from "@rozoai/intent-common";
import { formatUnits, getAddress } from "viem";
import { PollHandle, startPolling } from "../utils/polling";
import { TrpcClient } from "../utils/trpc";
import { PaymentEvent, PaymentState } from "./paymentFsm";
import { PaymentStore } from "./paymentStore";
import {
  ROZO_DAIMO_APP_ID,
  STELLAR_USDC_ISSUER_PK,
} from "../constants/rozoConfig";
import { createRozoPayment, createRozoPaymentRequest } from "../utils/api";

// Maps poller identifier to poll handle which terminates the poller
// key = `${type}:${orderId}`
const pollers = new Map<string, PollHandle>();

enum PollerType {
  FIND_SOURCE_PAYMENT = "find_source_payment",
  REFRESH_ORDER = "refresh_order",
}

function stopPoller(key: string) {
  pollers.get(key)?.();
  pollers.delete(key);
}

/**
 * Add a subscriber to the payment store that runs side effects in response to
 * events.
 *
 * @param store The payment store to subscribe to.
 * @param trpc TRPC client pointing to the Rozo Pay API.
 * @param log The logger to use for logging.
 * @returns A function that can be used to unsubscribe from the store.
 */
export function attachPaymentEffectHandlers(
  store: PaymentStore,
  trpc: TrpcClient,
  log: (msg: string) => void
): () => void {
  const unsubscribe = store.subscribe(({ prev, next, event }) => {
    log(
      `[EFFECT] processing effects for event ${event.type} on state transition ${prev.type} -> ${next.type}`
    );
    /* --------------------------------------------------
     * State-driven effects
     * -------------------------------------------------- */
    if (prev.type !== next.type) {
      // Start watching for source payment
      if (next.type === "payment_unpaid") {
        pollFindPayments(store, trpc, next.order.id);
      }

      // Refresh the order to watch for destination processing
      if (next.type === "payment_started") {
        pollRefreshOrder(store, trpc, next.order.id);
      }

      // Stop all pollers when the payment flow is completed or reset
      if (
        ["payment_completed", "payment_bounced", "error", "idle"].includes(
          next.type
        )
      ) {
        if ("order" in prev && prev.order) {
          stopPoller(`${PollerType.FIND_SOURCE_PAYMENT}:${prev.order.id}`);
          stopPoller(`${PollerType.REFRESH_ORDER}:${prev.order.id}`);
        }
      }
    }

    /* --------------------------------------------------
     * Event-driven effects
     * -------------------------------------------------- */
    switch (event.type) {
      case "set_pay_params":
        runSetPayParamsEffects(store, trpc, event);
        break;
      case "set_pay_id":
        runSetPayIdEffects(store, trpc, event);
        break;
      case "hydrate_order": {
        if (prev.type === "preview") {
          runHydratePayParamsEffects(store, trpc, prev, event);
        } else if (prev.type === "unhydrated") {
          runHydratePayIdEffects(store, trpc, prev, event);
        } else {
          log(`[EFFECT] invalid event ${event.type} on state ${prev.type}`);
        }
        break;
      }
      case "pay_source": {
        if (prev.type === "payment_unpaid") {
          runPaySourceEffects(store, trpc, prev);
        } else {
          log(`[EFFECT] invalid event ${event.type} on state ${prev.type}`);
        }
        break;
      }
      case "pay_ethereum_source": {
        if (prev.type === "payment_unpaid") {
          runPayEthereumSourceEffects(store, trpc, prev, event);
        } else {
          log(`[EFFECT] invalid event ${event.type} on state ${prev.type}`);
        }
        break;
      }
      case "pay_solana_source": {
        if (prev.type === "payment_unpaid") {
          runPaySolanaSourceEffects(store, trpc, prev, event);
        }
        log(`[EFFECT] invalid event ${event.type} on state ${prev.type}`);
        break;
      }
      // case "pay_stellar_source": {
      //   if (prev.type === "payment_unpaid") {
      //     runPayStellarSourceEffects(store, prev, event);
      //   }
      //   log(`[EFFECT] invalid event ${event.type} on state ${prev.type}`);
      //   break;
      // }
      default:
        break;
    }
  });

  const cleanup = () => {
    unsubscribe();
    pollers.forEach((_, key) => stopPoller(key));
    log("[EFFECT] unsubscribed from payment store and stopped all pollers");
  };

  return cleanup;
}

async function pollFindPayments(
  store: PaymentStore,
  trpc: TrpcClient,
  orderId: bigint
) {
  const key = `${PollerType.FIND_SOURCE_PAYMENT}:${orderId}`;

  const stopPolling = startPolling({
    key,
    intervalMs: 1_000,
    pollFn: () => trpc.findOrderPayments.query({ orderId: orderId.toString() }),
    onResult: (order: any) => {
      const state = store.getState();
      if (state.type !== "payment_unpaid") {
        stopPolling();
        return;
      }
      store.dispatch({ type: "order_refreshed", order });
    },
    onError: () => {},
  });

  pollers.set(key, stopPolling);
}

async function pollRefreshOrder(
  store: PaymentStore,
  trpc: TrpcClient,
  orderId: bigint
) {
  const key = `${PollerType.REFRESH_ORDER}:${orderId}`;

  const stopPolling = startPolling({
    key,
    intervalMs: 300,
    pollFn: () => trpc.getOrder.query({ id: orderId.toString() }),
    onResult: (res: any) => {
      const state = store.getState();
      // Check that we're still in the payment_started state
      if (state.type !== "payment_started") {
        stopPolling();
        return;
      }

      const order = res.order;
      store.dispatch({ type: "order_refreshed", order });
    },
    onError: () => {},
  });

  pollers.set(key, stopPolling);
}

async function runSetPayParamsEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  event: Extract<PaymentEvent, { type: "set_pay_params" }>
) {
  const payParams = event.payParams;
  // toUnits is undefined if and only if we're in deposit flow.
  // Set dummy value for deposit flow, since user can edit the amount.
  const toUnits = payParams.toUnits == null ? "0" : payParams.toUnits;

  // Validate payParams.
  assert(payParams.appId.length > 0, "PayParams: appId required");
  const isDepositFlow = payParams.toUnits == null;
  assert(
    !isDepositFlow || payParams.externalId == null,
    "PayParams: externalId unsupported in deposit mode"
  );

  try {
    const orderPreview = await trpc.previewOrder.query({
      // appId: payParams.appId,
      appId: ROZO_DAIMO_APP_ID,
      toChain: payParams.toChain,
      toToken: payParams.toToken,
      toUnits,
      toAddress: payParams.toAddress,
      toCallData: payParams.toCallData,
      isAmountEditable: payParams.toUnits == null,
      metadata: {
        intent: payParams.intent ?? "Pay",
        items: [],
        payer: {
          paymentOptions: payParams.paymentOptions,
          preferredChains: payParams.preferredChains,
          preferredTokens: payParams.preferredTokens,
          evmChains: payParams.evmChains,
        },
      },
      externalId: payParams.externalId,
      userMetadata: payParams.metadata,
      refundAddress: payParams.refundAddress,
    });

    store.dispatch({
      type: "preview_generated",
      // TODO: Properly type this and fix hacky type casting
      order: orderPreview as unknown as RozoPayOrderWithOrg,
      payParamsData: {
        // appId: payParams.appId,
        appId: ROZO_DAIMO_APP_ID,
        toStellarAddress: payParams.toStellarAddress,
        toAddress: payParams.toAddress,
        rozoAppId: payParams.appId,
      },
    });
  } catch (e: any) {
    store.dispatch({ type: "error", order: undefined, message: e.message });
  }
}

async function runSetPayIdEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  event: Extract<PaymentEvent, { type: "set_pay_id" }>
) {
  try {
    const { order } = await trpc.getOrder.query({
      id: readRozoPayOrderID(event.payId).toString(),
    });

    store.dispatch({
      type: "order_loaded",
      order,
    });
  } catch (e: any) {
    store.dispatch({ type: "error", order: undefined, message: e.message });
  }
}

async function runHydratePayParamsEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  prev: Extract<PaymentState, { type: "preview" }>,
  event: Extract<PaymentEvent, { type: "hydrate_order" }>
) {
  const order = prev.order;
  const payParams = prev.payParamsData;

  const toUnits = formatUnits(
    BigInt(order.destFinalCallTokenAmount.amount),
    order.destFinalCallTokenAmount.token.decimals
  );

  const toChain = getOrderDestChainId(order);
  const toToken = getAddress(order.destFinalCallTokenAmount.token.token);
  let toAddress = getAddress(order.destFinalCall.to);

  // ROZO API CALL
  // Pay In USDC Base, Pay Out USDC Stellar scenario
  let rozoPaymentId: string | undefined = order?.externalId ?? undefined;

  if (payParams?.toStellarAddress) {
    const paymentData = createRozoPaymentRequest({
      appId: payParams?.rozoAppId ?? ROZO_DAIMO_APP_ID,
      display: {
        intent: order?.metadata?.intent ?? "",
        paymentValue: String(toUnits),
        currency: "USD",
      },
      preferredChain: String(toChain),
      preferredToken: "USDC",
      destination: {
        destinationAddress: payParams?.toStellarAddress,
        chainId: String(stellar.chainId),
        amountUnits: toUnits,
        tokenSymbol: "USDC_XLM",
        tokenAddress: STELLAR_USDC_ISSUER_PK,
      },
      externalId: order?.externalId ?? "",
      metadata: {
        daimoOrderId: order?.id ?? "",
        ...(order?.metadata ?? {}),
      },
    });

    const rozoPayment = await createRozoPayment(paymentData);
    if (!rozoPayment?.data?.id) {
      throw new Error(rozoPayment?.error?.message ?? "Payment creation failed");
    }
    rozoPaymentId = rozoPayment.data.id;

    if (toChain === base.chainId && toToken === baseUSDC.token) {
      toAddress = rozoPayment.data.destination
        .destinationAddress as `0x${string}`;
    }
  }

  // END ROZO API CALL

  try {
    const { hydratedOrder } = await trpc.createOrder.mutate({
      // appId: prev.payParamsData.appId,
      appId: ROZO_DAIMO_APP_ID,
      paymentInput: {
        id: order.id.toString(),
        toChain: toChain,
        toToken,
        toUnits,
        toAddress,
        toCallData: order.destFinalCall.data,
        isAmountEditable: order.mode === RozoPayOrderMode.CHOOSE_AMOUNT,
        metadata: order.metadata,
        userMetadata: order.userMetadata,
        // externalId: order.externalId ?? undefined,
        externalId: rozoPaymentId,
      },
      // Prefer the refund address passed to this function, if specified. This
      // is for cases where the user pays from an EOA. Otherwise, use the refund
      // address specified by the dev.
      refundAddress: event.refundAddress ?? prev.order.refundAddr ?? undefined,
    });

    store.dispatch({
      type: "order_hydrated",
      order: hydratedOrder,
    });
  } catch (e: any) {
    store.dispatch({ type: "error", order: prev.order, message: e.message });
  }
}

async function runHydratePayIdEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  prev: Extract<PaymentState, { type: "unhydrated" }>,
  event: Extract<PaymentEvent, { type: "hydrate_order" }>
) {
  const order = prev.order;

  try {
    const { hydratedOrder } = await trpc.hydrateOrder.query({
      id: order.id.toString(),
      refundAddress: event.refundAddress,
    });

    store.dispatch({
      type: "order_hydrated",
      order: hydratedOrder,
    });
  } catch (e: any) {
    store.dispatch({ type: "error", order: prev.order, message: e.message });
  }
}

async function runPaySourceEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  prev: Extract<PaymentState, { type: "payment_unpaid" }>
) {
  const orderId = prev.order.id;

  try {
    const order = await trpc.findOrderPayments.query({
      orderId: orderId.toString(),
    });
    store.dispatch({ type: "order_refreshed", order });
  } catch (e: any) {
    store.dispatch({ type: "error", order: prev.order, message: e.message });
  }
}

async function runPayEthereumSourceEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  prev: Extract<PaymentState, { type: "payment_unpaid" }>,
  event: Extract<PaymentEvent, { type: "pay_ethereum_source" }>
) {
  const orderId = prev.order.id;

  try {
    const order = await trpc.processSourcePayment.mutate({
      orderId: orderId.toString(),
      sourceInitiateTxHash: event.paymentTxHash,
      sourceChainId: event.sourceChainId,
      sourceFulfillerAddr: event.payerAddress,
      sourceToken: event.sourceToken,
      sourceAmount: event.sourceAmount.toString(),
    });
    store.dispatch({ type: "payment_verified", order });
  } catch (e: any) {
    store.dispatch({ type: "error", order: prev.order, message: e.message });
  }
}

async function runPaySolanaSourceEffects(
  store: PaymentStore,
  trpc: TrpcClient,
  prev: Extract<PaymentState, { type: "payment_unpaid" }>,
  event: Extract<PaymentEvent, { type: "pay_solana_source" }>
) {
  const orderId = prev.order.id;

  try {
    const order = await trpc.processSolanaSourcePayment.mutate({
      orderId: orderId.toString(),
      startIntentTxHash: event.paymentTxHash,
      token: event.sourceToken,
    });
    store.dispatch({ type: "payment_verified", order });
  } catch (e: any) {
    store.dispatch({ type: "error", order: prev.order, message: e.message });
  }
}
