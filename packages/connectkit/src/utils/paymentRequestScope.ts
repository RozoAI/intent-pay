export const PAYMENT_REQUEST_SCOPE = "payment-flow";

type RequestScope = {
  controller: AbortController;
};

const scopes = new Map<string, RequestScope>();

export function beginRequestScope(scope: string = PAYMENT_REQUEST_SCOPE) {
  cancelRequestScope(scope);

  const controller = new AbortController();

  scopes.set(scope, { controller });

  return {
    signal: controller.signal,
  };
}

export function cancelRequestScope(scope: string = PAYMENT_REQUEST_SCOPE) {
  const active = scopes.get(scope);
  if (!active) return;

  active.controller.abort();
  scopes.delete(scope);
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /aborted/i.test(error.message))
  );
}

/**
 * Monotonic generation counter for scoping async work to the latest
 * request (e.g. the currently selected deposit option). AbortSignals
 * cancel in-flight fetches, but a response that already resolved still
 * runs its continuations — every state mutation after an await must
 * check `isStale(myGen)` and bail before touching shared state, or an
 * old option finishing last overwrites the active payment/address.
 */
export type RequestGeneration = {
  next: () => number;
  isStale: (gen: number) => boolean;
};

export function createRequestGeneration(): RequestGeneration {
  let current = 0;
  return {
    next: () => ++current,
    isStale: (gen) => gen !== current,
  };
}
