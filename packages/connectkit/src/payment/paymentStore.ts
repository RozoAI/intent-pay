import { createStore, waitForState } from "../stateStore";
import {
  initialPaymentState,
  PaymentEvent,
  paymentReducer,
  PaymentState,
} from "./paymentFsm";

export type PaymentStore = ReturnType<
  typeof createStore<PaymentState, PaymentEvent>
> & {
  apiVersion?: "v1" | "v2";
};

export function createPaymentStore(
  log?: (msg: string) => void,
  apiVersion: "v1" | "v2" = "v2"
): PaymentStore {
  const store = createStore<PaymentState, PaymentEvent>(
    (state, event) => paymentReducer(state, event),
    initialPaymentState
  ) as PaymentStore;
  
  // Attach apiVersion to the store for easy access
  store.apiVersion = apiVersion;
  
  return store;
}

/**
 * Wait for the `PaymentStore` to enter a state matching any of `validTypes`,
 * or reject as soon as it hits the `"error"` state.
 *
 * @returns Promise<T> resolving with the first matching state or rejecting with
 * the error message
 */
export function waitForPaymentState<
  const T extends readonly PaymentState["type"][]
>(
  store: PaymentStore,
  ...validTypes: T
): Promise<Extract<PaymentState, { type: T[number] }>>;
export function waitForPaymentState<
  const T extends readonly PaymentState["type"][]
>(
  store: PaymentStore,
  ...validTypesAndOptions: [...T, { signal?: AbortSignal } | undefined]
): Promise<Extract<PaymentState, { type: T[number] }>>;
export function waitForPaymentState<
  const T extends readonly PaymentState["type"][]
>(
  store: PaymentStore,
  ...validTypesAndMaybeOptions: [...T] | [...T, { signal?: AbortSignal }]
): Promise<Extract<PaymentState, { type: T[number] }>> {
  const last = validTypesAndMaybeOptions[validTypesAndMaybeOptions.length - 1];
  const options =
    last != null && typeof last === "object" && !Array.isArray(last)
      ? (last as { signal?: AbortSignal })
      : undefined;
  const types = (
    options
      ? validTypesAndMaybeOptions.slice(0, -1)
      : validTypesAndMaybeOptions
  ) as readonly PaymentState["type"][];

  return waitForState<
    PaymentState,
    PaymentEvent,
    Extract<PaymentState, { type: T[number] }>
  >(
    store,
    (s): s is Extract<PaymentState, { type: T[number] }> =>
      types.includes(s.type),
    (s) => s.type === "error",
    (s) => (s as Extract<PaymentState, { type: "error" }>).message,
    options,
  );
}
