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
    "consumer-dest-memo",
    "metadata.memo keeps the consumer destination memo",
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
  t.equal(
    (order.metadata as any).memo,
    "consumer-dest-memo",
    "consumer destination memo is preserved distinctly in metadata",
  );
  t.end();
});

test("native SOL source uses destination USD for usdValue, not SOL units", (t) => {
  // Canonical backend value plus both System Program sentinels the proxy/SDK
  // may echo. An address-only check misses "native" and the legacy alias.
  for (const tokenAddress of [
    "native",
    "11111111111111111111111111111111",
    "11111111111111111111111111111112",
  ]) {
    const order = formatPaymentResponseToHydratedOrder(
      makeResponse({
        source: {
          amount: "0.125", // SOL units, NOT USD
          chainId: 900,
          tokenAddress,
          receiverAddress: DEPOSIT,
        },
        destination: {
          chainId: String(base.chainId),
          tokenAddress: baseUSDC.token,
          amount: "20",
          receiverAddress: DEST,
        },
      }),
    );
    t.equal(order.usdValue, 20, `${tokenAddress}: usdValue reflects destination USD`);
    t.equal(
      order.destFinalCallTokenAmount.usd,
      20,
      `${tokenAddress}: destFinalCallTokenAmount.usd is destination USD`,
    );
    t.equal(
      (order.metadata as any).sourceAmountUnits,
      "0.125",
      `${tokenAddress}: source amount stays in native units in metadata`,
    );
  }
  t.end();
});

test("no fallback to metadata.memo when deposit memo is missing", (t) => {
  const res = makeResponse();
  delete res.source.receiverMemo;
  const order = formatPaymentResponseToHydratedOrder(res);
  t.equal(order.memo, null, "missing deposit memo surfaces as null");
  t.equal(
    (order.metadata as any).memo,
    "consumer-dest-memo",
    "destination memo stays in metadata, never as pay-in instruction",
  );
  t.end();
});
