import test from "tape";
import { formatPaymentResponseToHydratedOrder } from "../src/bridge-utils";
import { baseUSDC } from "../src/token";
import { base } from "../src/chain";

const DEPOSIT = "GB4C3KPQ4Z5K2M7N6P8QRS9T0UVWXYZABCDEFGHIJK123";
const DEST = "0x1a5FdBc891c5D4E6aD68064Ae45D43146D4F9f3a";

function makeResponse(overrides: any = {}) {
  return {
    id: "pay_123",
    externalId: "pay_123",
    createdAt: "2026-09-06T10:00:00.000Z",
    updatedAt: "2026-09-06T10:00:00.000Z",
    expiresAt: "2026-09-06T11:00:00.000Z",
    source: {
      amount: "10.5",
      chainId: base.chainId,
      tokenAddress: baseUSDC.token,
      receiverAddress: DEPOSIT,
      receiverMemo: "deposit-memo-1",
    },
    destination: {
      chainId: String(base.chainId),
      tokenAddress: baseUSDC.token,
      amountUnits: "10.5",
      receiverAddress: DEST,
    },
    metadata: { memo: "consumer-dest-memo" },
    ...overrides,
  } as any;
}

test("formatter maps deposit address/memo/expiry from payment response", (t) => {
  const order = formatPaymentResponseToHydratedOrder(makeResponse());
  t.equal(order.intentAddr, DEPOSIT, "intentAddr is the deposit address");
  t.equal(order.memo, "deposit-memo-1", "memo is the deposit memo");
  t.equal(
    (order.metadata as any).memo,
    "deposit-memo-1",
    "metadata.memo is the deposit memo",
  );
  t.equal(
    order.expirationTs,
    BigInt(Math.floor(new Date("2026-09-06T11:00:00.000Z").getTime() / 1000)),
    "expirationTs is expiresAt in epoch seconds",
  );
  t.end();
});

test("source.receiverMemo wins over metadata.memo", (t) => {
  const order = formatPaymentResponseToHydratedOrder(makeResponse());
  t.equal(
    order.memo,
    "deposit-memo-1",
    "consumer destination memo must never override the deposit memo",
  );
  t.end();
});

test("falls back to metadata.memo when no deposit memo", (t) => {
  const res = makeResponse();
  delete res.source.receiverMemo;
  const order = formatPaymentResponseToHydratedOrder(res);
  t.equal(order.memo, "consumer-dest-memo", "falls back to metadata.memo");
  t.end();
});
