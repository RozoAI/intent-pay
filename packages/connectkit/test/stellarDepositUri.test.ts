import { generateStellarDeepLink } from "@rozoai/intent-common";
import { describe, expect, it } from "vitest";
import { resolveDepositSourceAmount } from "../src/payment/createPaymentPayload.js";

const ISSUER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const DEST = "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMK";

function makeFees(amount: string, fee = "0") {
  return {
    status: "ok",
    type: "fee",
    source: { chainId: "1500", tokenSymbol: "USDC", amount, fee },
    destination: { chainId: "8453", tokenSymbol: "USDC", amount: "10" },
    feeInfo: { feePercentage: "0.5%", minimumFee: "0" },
  } as any;
}

/**
 * Same composition as payWithDepositAddress: the authoritative source
 * amount feeds the SEP-0007 QR, and only the deposit memo (order.memo)
 * is attached — never the consumer destination memo.
 */
function buildQrUri(args: {
  responseAmount: string | null;
  fees: any;
  fallbackUsd: number;
  tokenAddress: string;
  tokenSymbol: string;
  depositMemo: string | null;
}) {
  const amount = resolveDepositSourceAmount(
    args.responseAmount,
    args.fees,
    args.fallbackUsd,
  );
  return generateStellarDeepLink({
    destination: DEST,
    amount,
    tokenAddress: args.tokenAddress,
    tokenSymbol: args.tokenSymbol,
    memo: args.depositMemo || undefined,
  });
}

describe("stellar deposit QR", () => {
  it("encodes the fee-inclusive source amount, not the destination USD value", () => {
    const uri = buildQrUri({
      responseAmount: "10.5",
      fees: makeFees("10.5", "0.5"),
      fallbackUsd: 10,
      tokenAddress: `USDC:${ISSUER}`,
      tokenSymbol: "USDC",
      depositMemo: "deposit-memo-1",
    });
    expect(uri).toBe(
      `web+stellar:pay?destination=${DEST}&amount=10.5&asset_code=USDC&asset_issuer=${ISSUER}&memo=deposit-memo-1&memo_type=MEMO_TEXT`,
    );
  });

  it("encodes non-dollar-pegged source units verbatim (XLM)", () => {
    const uri = buildQrUri({
      responseAmount: "42",
      fees: makeFees("42", "0.1"),
      fallbackUsd: 10,
      tokenAddress: "11111111111111111111111111111111",
      tokenSymbol: "XLM",
      depositMemo: "deposit-memo-1",
    });
    expect(uri).toContain("amount=42");
    expect(uri).not.toContain("amount=10");
  });

  it("falls back to the fee quote when the response carries no amount", () => {
    const uri = buildQrUri({
      responseAmount: null,
      fees: makeFees("10.5", "0.5"),
      fallbackUsd: 10,
      tokenAddress: `USDC:${ISSUER}`,
      tokenSymbol: "USDC",
      depositMemo: "deposit-memo-1",
    });
    expect(uri).toContain("amount=10.5");
  });

  it("omits the memo when the deposit memo is missing", () => {
    const uri = buildQrUri({
      responseAmount: "10.5",
      fees: makeFees("10.5", "0.5"),
      fallbackUsd: 10,
      tokenAddress: `USDC:${ISSUER}`,
      tokenSymbol: "USDC",
      depositMemo: null,
    });
    expect(uri).not.toContain("memo=");
  });
});
