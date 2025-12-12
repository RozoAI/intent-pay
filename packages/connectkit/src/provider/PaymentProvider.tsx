import { setApiConfig } from "@rozoai/intent-common";
import {
  createContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { attachPaymentEffectHandlers } from "../payment/paymentEffects";
import { createPaymentStore, PaymentStore } from "../payment/paymentStore";
import { createTrpcClient } from "../utils/trpc";

export const PaymentContext = createContext<PaymentStore | null>(null);

type PaymentProviderProps = {
  children: React.ReactNode;
  payApiUrl: string;
  apiVersion?: "v1" | "v2";
  log?: (msg: string) => void;
};

export function PaymentProvider({
  children,
  payApiUrl,
  apiVersion = "v2",
  log = console.log,
}: PaymentProviderProps) {
  // Initialize API configuration with the provided version
  useEffect(() => {
    setApiConfig({ version: apiVersion });
    log(`[PAYMENT PROVIDER] API version set to ${apiVersion}`);
  }, [apiVersion]);

  // Generate unique sessionId for tracking in the backend
  const [sessionId] = useState(() => crypto.randomUUID().replaceAll("-", ""));
  const trpc = useMemo(
    () => createTrpcClient(payApiUrl, sessionId),
    [payApiUrl, sessionId]
  );

  const store = useMemo(
    () => createPaymentStore(log, apiVersion),
    [log, apiVersion]
  );

  // Attach subscriber to run side effects in response to events. Use a
  // layout effect that runs before the first render.
  useLayoutEffect(() => {
    const unsubscribe = attachPaymentEffectHandlers(
      store,
      trpc,
      log,
      apiVersion
    );
    log("[EFFECT] subscribed to payment effects");
    return unsubscribe;
  }, [store, trpc, log, apiVersion]);

  return (
    <PaymentContext.Provider value={store}>{children}</PaymentContext.Provider>
  );
}
