/**
 * Payment Event Emitter
 *
 * Singleton event emitter for payment events that works reliably across
 * module boundaries in both workspace and built packages.
 *
 * This solves the issue where useEffect hooks don't trigger in built packages
 * due to React dependency tracking differences.
 */

type PaymentEventType =
  | "payment_started"
  | "payment_completed"
  | "payment_bounced"
  | "payout_completed";

type PaymentEventCallback = (data: any) => void;

class PaymentEventEmitter {
  private listeners = new Map<PaymentEventType, Set<PaymentEventCallback>>();
  private processedEvents = new Set<string>();

  /**
   * Subscribe to a payment event type
   */
  subscribe(eventType: PaymentEventType, callback: PaymentEventCallback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * Emit a payment event
   * Prevents duplicate events for the same order + event type combination
   */
  emit(
    eventType: PaymentEventType,
    orderId: string | bigint | null | undefined,
    data: any
  ) {
    console.log("[PaymentEventEmitter] emit", eventType, orderId, data);
    if (!orderId) return;

    const orderIdString = String(orderId);
    const eventKey = `${eventType}-${orderIdString}`;

    // Prevent duplicate events
    if (this.processedEvents.has(eventKey)) {
      return;
    }
    this.processedEvents.add(eventKey);

    // Emit to all listeners
    this.listeners.get(eventType)?.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error(
          `[PaymentEventEmitter] Callback error for ${eventType}:`,
          err
        );
      }
    });
  }

  /**
   * Reset processed events for a specific order
   * Called when order changes to allow events to fire again for new orders
   */
  reset(orderId: string | bigint | null | undefined) {
    if (!orderId) {
      // Reset all if no order ID provided
      this.processedEvents.clear();
      return;
    }

    const orderIdString = String(orderId);
    // Clear processed events for this order
    Array.from(this.processedEvents).forEach((key) => {
      if (key.includes(orderIdString)) {
        this.processedEvents.delete(key);
      }
    });
  }

  /**
   * Clear all processed events (for testing/debugging)
   */
  clear() {
    this.processedEvents.clear();
  }
}

// Singleton instance - works across module boundaries
export const paymentEventEmitter = new PaymentEventEmitter();
