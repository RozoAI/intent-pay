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
