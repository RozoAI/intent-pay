import {
  RozoPayIntentStatus,
  RozoPayOrderMode,
  type RozoPayHydratedOrderWithOrg,
} from "@rozoai/intent-common";
import { describe, expect, it } from "vitest";
import { paymentReducer, type PaymentState } from "../src/payment/paymentFsm.js";

// Regression guard for the deposit-address flow. A pay-in hash (seen by Pusher
// or polling) must never be enough to reach payout_completed. Payment
// ea29be71-4963-4a70-9af0-98adbf6bd769 (HyperEVM deposit to Stellar USDC,
// 2026-09-17) was parked in payment_payout_review on the backend while the
// consumer showed "Payout completed", the symptom the old WaitingDepositAddress
// handler produced by calling setPaymentPayoutCompleted with the pay-in hash.
// setPaymentCompleted refreshes the order with intentStatus COMPLETED and
// destFastFinishTxHash set to the pay-in hash; that refresh must stay in
// payment_completed, and only a PAYOUT_COMPLETED refresh may advance.

const PAYIN_TX = "0x9ea59d1120b115be39c6015a321e71f496c81f925f8417d782cf2552f1936e28";
const PAYOUT_TX = "9ac942ee0468b3da3359486f79f3b5056f34c6935de66328e6aa561377f1bfce";

function hydratedOrder(
  intentStatus: RozoPayIntentStatus,
  extra: Record<string, unknown> = {},
): RozoPayHydratedOrderWithOrg {
  return {
    id: 1n,
    mode: RozoPayOrderMode.HYDRATED,
    intentStatus,
    externalId: "ea29be71-4963-4a70-9af0-98adbf6bd769",
    sourceStartTxHash: PAYIN_TX,
    ...extra,
  } as unknown as RozoPayHydratedOrderWithOrg;
}

describe("paymentReducer payout completion", () => {
  const completed: PaymentState = {
    type: "payment_completed",
    order: hydratedOrder(RozoPayIntentStatus.COMPLETED),
  };

  it("stays in payment_completed when the refreshed order only carries the pay-in hash", () => {
    const next = paymentReducer(completed, {
      type: "order_refreshed",
      order: hydratedOrder(RozoPayIntentStatus.COMPLETED, {
        destFastFinishTxHash: PAYIN_TX,
      }),
    });
    expect(next.type).toBe("payment_completed");
  });

  it("moves to payout_completed only on a PAYOUT_COMPLETED refresh", () => {
    const next = paymentReducer(completed, {
      type: "order_refreshed",
      order: hydratedOrder(RozoPayIntentStatus.PAYOUT_COMPLETED, {
        payoutTransactionHash: PAYOUT_TX,
      }),
    });
    expect(next.type).toBe("payout_completed");
    if (next.type === "payout_completed") {
      expect(next.order.payoutTransactionHash).toBe(PAYOUT_TX);
    }
  });

  it("ignores a PAYOUT_COMPLETED refresh on an unhydrated order", () => {
    const next = paymentReducer(completed, {
      type: "order_refreshed",
      order: {
        ...hydratedOrder(RozoPayIntentStatus.PAYOUT_COMPLETED),
        mode: RozoPayOrderMode.SALE,
      } as unknown as RozoPayHydratedOrderWithOrg,
    });
    expect(next.type).toBe("payment_completed");
  });

  it("does not leave payout_completed on a later COMPLETED refresh", () => {
    const paidOut: PaymentState = {
      type: "payout_completed",
      order: hydratedOrder(RozoPayIntentStatus.PAYOUT_COMPLETED, {
        payoutTransactionHash: PAYOUT_TX,
      }),
    };
    const next = paymentReducer(paidOut, {
      type: "order_refreshed",
      order: hydratedOrder(RozoPayIntentStatus.COMPLETED),
    });
    expect(next.type).toBe("payout_completed");
  });
});
