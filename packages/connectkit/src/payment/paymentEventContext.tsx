import { PaymentStatus } from "@rozoai/intent-common";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useRef,
} from "react";

/**
 * Payment event types that can be emitted during the payment lifecycle
 */
export type PaymentEventType =
  | PaymentStatus.PaymentStarted
  | PaymentStatus.PaymentCompleted
  | PaymentStatus.PaymentBounced
  | PaymentStatus.PaymentPayoutCompleted;

/**
 * Event data structure for payment events
 */
export interface PaymentEventData {
  order: any; // TODO: Import Order type from @rozoai/intent-common
  rozoPaymentId: string;
}

/**
 * Callback function type for event listeners
 */
export type PaymentEventCallback = (data: PaymentEventData) => void;

/**
 * Context value interface
 */
interface PaymentEventContextValue {
  /**
   * Subscribe to a payment event
   * @param event - The event type to listen for
   * @param callback - Function to call when event is emitted
   * @returns Unsubscribe function
   */
  subscribe: (
    event: PaymentEventType,
    callback: PaymentEventCallback,
  ) => () => void;

  /**
   * Emit a payment event
   * @param event - The event type to emit
   * @param data - Event data containing order and payment ID
   */
  emit: (event: PaymentEventType, data: PaymentEventData) => void;

  /**
   * Reset the event emitter state
   * Clears all processed events tracking
   */
  reset: () => void;
}

/**
 * Context for payment event management
 * Provides pub/sub functionality for payment lifecycle events
 */
const PaymentEventContext = createContext<PaymentEventContextValue | null>(
  null,
);

/**
 * Provider component for payment event management
 *
 * Creates an isolated event bus for each RozoPayButton instance.
 * Handles event deduplication and automatic cleanup on unmount.
 *
 * @example
 * ```tsx
 * <PaymentEventProvider>
 *   <RozoPayModal />
 * </PaymentEventProvider>
 * ```
 */
export function PaymentEventProvider({ children }: { children: ReactNode }) {
  // Store listeners for each event type
  // Using ref to avoid re-renders when listeners change
  const listenersRef = useRef(
    new Map<PaymentEventType, Set<PaymentEventCallback>>(),
  );

  // Track processed events to prevent duplicates
  // Key format: "eventType:orderId:rozoPaymentId"
  const processedEventsRef = useRef(new Set<string>());

  /**
   * Subscribe to an event
   * Returns unsubscribe function for cleanup
   */
  const subscribe = useCallback(
    (event: PaymentEventType, callback: PaymentEventCallback) => {
      // Initialize listener set for this event type if needed
      if (!listenersRef.current.has(event)) {
        listenersRef.current.set(event, new Set());
      }

      // Add callback to listeners
      const listeners = listenersRef.current.get(event)!;
      listeners.add(callback);

      // Return unsubscribe function
      return () => {
        listeners.delete(callback);
        // Clean up empty listener sets
        if (listeners.size === 0) {
          listenersRef.current.delete(event);
        }
      };
    },
    [],
  );

  /**
   * Emit an event to all subscribers
   * Implements deduplication to prevent duplicate event processing
   */
  const emit = useCallback(
    (event: PaymentEventType, data: PaymentEventData) => {
      // Extract transaction hash for deduplication (specific to payment/payout events)
      const getTxHash = (order: any, event: PaymentEventType): string => {
        if (event === PaymentStatus.PaymentCompleted) {
          return order?.sourceStartTxHash || order?.payinTransactionHash || "";
        }
        if (event === PaymentStatus.PaymentPayoutCompleted) {
          return (
            order?.payoutTransactionHash || order?.destination?.txHash || ""
          );
        }
        return "";
      };

      const txHash = getTxHash(data.order, event);

      // Create unique key for deduplication
      // Include txHash for payment_completed and payout_completed to ensure
      // we deduplicate based on actual transaction, not just order ID
      const eventKey = `${event}:${data.order?.externalId}:${data.rozoPaymentId}:${txHash}`;

      // Skip if this exact event was already processed
      if (processedEventsRef.current.has(eventKey)) {
        return;
      }

      // Mark event as processed
      processedEventsRef.current.add(eventKey);

      // Get listeners for this event type
      const listeners = listenersRef.current.get(event);
      if (!listeners || listeners.size === 0) {
        return;
      }

      // Call all listeners
      // Create array copy to avoid issues if listener unsubscribes during iteration
      const listenersArray = Array.from(listeners);
      for (const callback of listenersArray) {
        try {
          callback(data);
        } catch (error) {
          // Log error but don't stop other callbacks
          console.error(`Error in payment event listener for ${event}:`, error);
        }
      }
    },
    [],
  );

  /**
   * Reset processed events tracking
   * Useful when starting a new payment flow
   */
  const reset = useCallback(() => {
    processedEventsRef.current.clear();
  }, []);

  const value: PaymentEventContextValue = {
    subscribe,
    emit,
    reset,
  };

  return (
    <PaymentEventContext.Provider value={value}>
      {children}
    </PaymentEventContext.Provider>
  );
}

/**
 * Hook to access payment event system
 *
 * Must be used within a PaymentEventProvider
 *
 * @returns Payment event management functions
 * @throws Error if used outside PaymentEventProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { subscribe, emit } = usePaymentEvents();
 *
 *   useEffect(() => {
 *     return subscribe('payment_completed', (data) => {
 *       console.log('Payment completed!', data);
 *     });
 *   }, [subscribe]);
 * }
 * ```
 */
export function usePaymentEvents(): PaymentEventContextValue {
  const context = useContext(PaymentEventContext);

  if (!context) {
    throw new Error(
      "usePaymentEvents must be used within a PaymentEventProvider",
    );
  }

  return context;
}
