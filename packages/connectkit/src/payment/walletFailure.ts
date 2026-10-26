/**
 * Classifies a failed wallet send so PayWithToken can show the payer a way
 * out instead of a bare "Retry Payment".
 *
 * Why this exists: on 2026-10-26 a returning payer's Phantom (an EIP-7702
 * delegated EOA on Base) answered every `eth_sendTransaction` with a JSON-RPC
 * internal error (-32603 "Unexpected error") in 1-2 s, before any wallet
 * popup. viem wraps that as `ContractFunctionExecutionError` whose text reads
 * like an on-chain revert ("The contract function "transfer" reverted with the
 * following reason: Unexpected error"), the modal titled it "Payment
 * Cancelled" and offered only Retry. The payer retried 7 times across 3
 * invoices, then found Solana on his own. Nothing was ever broadcast.
 *
 * The chain was fine (historical eth_call replay of the same transfer
 * succeeds), so there is nothing to fix on our side of the transaction. What
 * we can do is (1) stop calling a wallet-side failure a cancellation, (2) put
 * "Pay another way" (manual transfer to a one-time address, which the wallet's
 * own send UI handles) in front of the payer, and (3) record enough in the
 * failure event to triage the next case without pulling chain data by hand.
 *
 * Design rules:
 * - Pure functions, no React, no wallet calls: unit-tested in isolation.
 * - Classification is conservative. Anything not clearly a user rejection or
 *   a wallet-internal RPC error stays "other", and "other" keeps today's UI
 *   (Retry first) until the second failure.
 * - Account-type detection reads the payer's code; it never blocks or changes
 *   the payment path, it only labels the event.
 */

export type WalletFailureKind = "user_rejected" | "wallet_internal" | "other";

export interface WalletFailure {
  kind: WalletFailureKind;
  /** JSON-RPC / EIP-1193 error code found on the error chain, if any. */
  rpcCode: number | null;
  /** Original message, unchanged, for telemetry and the support prefill. */
  message: string;
}

/** EIP-1193 user rejection. */
const USER_REJECTED_CODE = 4001;
/** JSON-RPC internal error: the provider itself failed, not the chain. */
const INTERNAL_RPC_CODE = -32603;

/**
 * After this many consecutive failures of the same wallet option in one
 * modal session, "Pay another way" becomes the primary button and Retry the
 * secondary. Registered in ainative docs/policy/magic-numbers.md (2026-10-27,
 * agent-set, adjustable).
 */
export const PAY_ANOTHER_WAY_PRIMARY_AFTER_FAILURES = 2;

/** Walks `cause` links and viem's `walk()` to collect every error in the chain. */
function errorChain(err: unknown): unknown[] {
  const seen: unknown[] = [];
  let cur: unknown = err;
  for (let i = 0; i < 10 && cur != null && !seen.includes(cur); i++) {
    seen.push(cur);
    cur = (cur as { cause?: unknown }).cause;
  }
  return seen;
}

function firstNumber(values: unknown[]): number | null {
  for (const v of values) if (typeof v === "number" && Number.isFinite(v)) return v;
  return null;
}

export function classifyWalletFailure(err: unknown): WalletFailure {
  const chain = errorChain(err);
  const message =
    (err as { shortMessage?: string } | null)?.shortMessage ??
    (err as { message?: string } | null)?.message ??
    (typeof err === "string" ? err : "unknown_error");
  const rpcCode = firstNumber(chain.map((e) => (e as { code?: unknown })?.code));
  const text = chain
    .map((e) => `${(e as { message?: string })?.message ?? ""} ${(e as { details?: string })?.details ?? ""}`)
    .join(" ")
    .toLowerCase();

  if (
    rpcCode === USER_REJECTED_CODE ||
    /user rejected|user denied|rejected the request|user cancel/.test(text)
  ) {
    return { kind: "user_rejected", rpcCode, message };
  }

  if (
    rpcCode === INTERNAL_RPC_CODE ||
    /\bunexpected error\b|internal (json-?rpc )?error|internal error/.test(text)
  ) {
    return { kind: "wallet_internal", rpcCode, message };
  }

  return { kind: "other", rpcCode, message };
}

/** EIP-7702 delegation designator prefix (EIP-7702 §"Delegation Designation"). */
const EIP7702_PREFIX = "0xef0100";

export type PayerAccountType = "eoa" | "eip7702" | "contract" | "unknown";

/** Labels the payer's account from `eth_getCode`. Pass `undefined` for "read failed". */
export function classifyPayerCode(code: string | null | undefined): PayerAccountType {
  if (code === undefined) return "unknown";
  if (code == null || code === "0x" || code === "") return "eoa";
  if (code.toLowerCase().startsWith(EIP7702_PREFIX)) return "eip7702";
  return "contract";
}

/** Whether "Pay another way" should be the primary action. */
export function shouldPromotePayAnotherWay(
  failure: WalletFailure | null,
  consecutiveFailures: number,
): boolean {
  if (failure?.kind === "wallet_internal") return true;
  return consecutiveFailures >= PAY_ANOTHER_WAY_PRIMARY_AFTER_FAILURES;
}

/** Title shown above the failed state. */
export function walletFailureTitle(failure: WalletFailure | null): string | null {
  if (failure?.kind === "wallet_internal") return "Wallet Could Not Send";
  return null;
}

/** One payer-facing sentence. Never the raw viem text. */
export function walletFailureMessage(
  failure: WalletFailure | null,
  walletName?: string | null,
): string | null {
  if (!failure) return null;
  const wallet = walletName?.trim() || "Your wallet";
  switch (failure.kind) {
    case "wallet_internal":
      return `${wallet} returned an internal error before the transaction was sent. Nothing was charged. You can pay another way below.`;
    case "user_rejected":
      return null;
    default:
      return `${wallet} could not complete this transaction. Nothing was charged.`;
  }
}
