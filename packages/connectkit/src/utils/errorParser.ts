/**
 * Parses error messages, attempting to extract meaningful information from JSON error responses
 * @param error - The error object or message to parse
 * @returns A human-readable error message
 */
export function parseErrorMessage(error: unknown): string {
  let message = "Something bad happened";

  // Extract base message
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  }

  // Try to parse JSON error messages.
  //
  // Every branch below MUST return a string. `parsed.message` and
  // `parsed.error.message` come straight off an API response body, so they
  // can perfectly well be an object (e.g. `{"message": {"code": ..., ...}}`)
  // — returning one made the caller stringify it to the literal
  // "[object Object]", which is exactly what 5 of the 27 our-side failures
  // in the 2026-09-03..09 window reported instead of a cause.
  try {
    const parsed = JSON.parse(message);
    const candidate =
      parsed?.message ??
      (typeof parsed?.error === "string" ? parsed.error : parsed?.error?.message);
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate;
    }
    if (candidate != null) {
      // Structured but not a string: keep the detail rather than dropping it.
      return safeStringify(candidate);
    }
  } catch {
    // If parsing fails, return the original message
  }

  return message;
}

/** JSON.stringify that can never throw (cycles) and never returns undefined. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Build the error thrown when `createPayment` / `handleCreateRozoPayment`
 * resolves to `undefined`.
 *
 * Those helpers report the real API failure by dispatching an `error` action
 * onto the payment store and *then* returning `undefined`. Call sites used to
 * turn that `undefined` into a bare `new Error("Failed to create Rozo
 * payment")`, discarding the only diagnostic that existed: in the
 * 2026-09-03..09 window 14 of 27 our-side failures reached telemetry as that
 * bare string, all on Stellar (chain 1500), with nothing to say what the API
 * had actually rejected. Read the dispatched message back off the store so
 * the real cause travels with the throw.
 */
export function createPaymentFailureError(store?: {
  getState?: () => unknown;
}): Error {
  let detail = "";
  try {
    const state = store?.getState?.() as { message?: unknown } | undefined;
    const message = state?.message;
    if (typeof message === "string") {
      detail = message.trim();
    } else if (message != null) {
      detail = safeStringify(message);
    }
  } catch {
    // A store that cannot be read must not mask the original failure.
  }
  return new Error(
    detail !== ""
      ? `Failed to create Rozo payment: ${detail}`
      : "Failed to create Rozo payment (API reported no error detail)",
  );
}

/**
 * Categorizes error types for better user experience
 */
export enum ErrorType {
  LIQUIDITY = "liquidity",
  PAYMENT_FAILED = "payment_failed",
  NETWORK = "network",
  INSUFFICIENT_FUNDS = "insufficient_funds",
  REJECTED = "rejected",
  TRUSTLINE = "trustline",
  UNKNOWN = "unknown",
  NOT_UNPAID = "not_unpaid",
  UNSUPPORTED_CHAIN = "unsupported_chain",
}

/**
 * Determines the error category based on the error message
 * @param errorMessage - The error message to categorize
 * @returns The error category
 */
export function categorizeError(errorMessage: string): ErrorType {
  const lowerMsg = errorMessage.toLowerCase();

  if (
    lowerMsg.includes("trustline") ||
    lowerMsg.includes("recipient_trustline")
  ) {
    return ErrorType.TRUSTLINE;
  }

  if (lowerMsg.includes("liquidity") || lowerMsg.includes("exceeds limit")) {
    return ErrorType.LIQUIDITY;
  }

  if (
    lowerMsg.includes("payment failed") ||
    lowerMsg.includes("transaction failed")
  ) {
    return ErrorType.PAYMENT_FAILED;
  }

  if (
    lowerMsg.includes("caip25") ||
    lowerMsg.includes("authorizedscopes") ||
    lowerMsg.includes("not supported by the wallet") ||
    lowerMsg.includes("attempting to switch chain")
  ) {
    return ErrorType.UNSUPPORTED_CHAIN;
  }

  if (lowerMsg.includes("network") || lowerMsg.includes("connection")) {
    return ErrorType.NETWORK;
  }

  if (
    lowerMsg.includes("insufficient funds") ||
    lowerMsg.includes("insufficient balance")
  ) {
    return ErrorType.INSUFFICIENT_FUNDS;
  }

  if (lowerMsg.includes("rejected") || lowerMsg.includes("denied")) {
    return ErrorType.REJECTED;
  }

  if (lowerMsg.includes("no longer unpaid")) {
    return ErrorType.NOT_UNPAID;
  }

  return ErrorType.UNKNOWN;
}
