import { PaymentStatus } from "@rozoai/intent-common";
import { useEffect, useRef, useState } from "react";
import { PayLogFn } from "../provider/PayContext";

// Pusher types - defined here to avoid requiring pusher-js types
interface PusherChannel {
  bind(event: string, callback: (data: any) => void): void;
  unbind(event: string, callback?: (data: any) => void): void;
  unsubscribe(): void;
}

interface Pusher {
  subscribe(channel: string): PusherChannel;
  unsubscribe(channel: string): void;
  disconnect(): void;
}

interface PusherStatusUpdatePayload {
  payment_id: string;
  status: PaymentStatus.PaymentPayoutCompleted;
  source_txhash?: string;
  destination_txhash?: string;
}

export interface UsePusherPayoutOptions {
  /** Whether Pusher integration is enabled */
  enabled: boolean | undefined;
  /** The Rozo payment ID to subscribe to */
  rozoPaymentId: string | undefined;
  /** Callback when payout completed status is received */
  onPayoutCompleted?: (payload: PusherStatusUpdatePayload) => void;
  /** Logging function */
  log: PayLogFn;
}

export interface UsePusherPayoutResult {
  /** Whether Pusher is connected */
  isConnected: boolean;
  /** Last received status update */
  lastStatusUpdate: PusherStatusUpdatePayload | null;
}

/**
 * Pusher configuration constants
 */
const PUSHER_CONFIG = {
  appId: "2090164",
  key: "22273733a3d287ae4279",
  cluster: "us2",
} as const;

/**
 * Hook to subscribe to Pusher real-time payment status updates.
 * Listens for payment_payout_completed status updates.
 *
 * @param options - Configuration options for Pusher integration
 * @returns Pusher connection state and last status update
 */
export const usePusherPayout = (
  options: UsePusherPayoutOptions
): UsePusherPayoutResult => {
  const { enabled, rozoPaymentId, onPayoutCompleted, log } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastStatusUpdate, setLastStatusUpdate] =
    useState<PusherStatusUpdatePayload | null>(null);

  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<PusherChannel | null>(null);
  const statusUpdateHandlerRef = useRef<
    ((data: PusherStatusUpdatePayload) => void) | null
  >(null);

  // Store callbacks in refs to prevent infinite loops
  const onPayoutCompletedRef = useRef(onPayoutCompleted);
  const logRef = useRef(log);

  // Update refs when callbacks change (without triggering re-renders)
  useEffect(() => {
    onPayoutCompletedRef.current = onPayoutCompleted;
    logRef.current = log;
  });

  useEffect(() => {
    // Early return if disabled or missing payment ID
    if (!enabled || !rozoPaymentId) {
      // Clean up if we have an active connection
      if (channelRef.current) {
        channelRef.current.unbind(
          "status-update",
          statusUpdateHandlerRef.current ?? undefined
        );
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`payments-${rozoPaymentId}`);
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    // Dynamically import pusher-js to make it optional
    let isActive = true;

    const initializePusher = async () => {
      try {
        // Dynamic import to handle optional dependency
        const PusherModule = await import("pusher-js");
        const Pusher = PusherModule.default || PusherModule;

        // Initialize Pusher client
        const pusher = new Pusher(PUSHER_CONFIG.key, {
          cluster: PUSHER_CONFIG.cluster,
          // enabledTransports: ["ws", "wss"],
        });

        if (!isActive) {
          pusher.disconnect();
          return;
        }

        pusherRef.current = pusher as unknown as Pusher;

        // Subscribe to payment channel
        const channelName = `payments-${rozoPaymentId}`;
        const channel = pusher.subscribe(channelName);

        if (!isActive) {
          channel.unsubscribe();
          pusher.disconnect();
          return;
        }

        channelRef.current = channel as unknown as PusherChannel;

        // Handle connection state
        pusher.connection.bind("connected", () => {
          if (isActive) {
            logRef.current("[PUSHER] Connected to Pusher");
            setIsConnected(true);
          }
        });

        pusher.connection.bind("disconnected", () => {
          if (isActive) {
            logRef.current("[PUSHER] Disconnected from Pusher");
            setIsConnected(false);
          }
        });

        pusher.connection.bind("error", (err: any) => {
          if (isActive) {
            logRef.current("[PUSHER] Connection error:", err);
            setIsConnected(false);
          }
        });

        // Handle subscription success
        channel.bind("pusher:subscription_succeeded", () => {
          if (isActive) {
            logRef.current(`[PUSHER] Subscribed to channel: ${channelName}`);
          }
        });

        channel.bind("pusher:subscription_error", (err: any) => {
          if (isActive) {
            logRef.current(
              `[PUSHER] Subscription error for channel ${channelName}:`,
              err
            );
          }
        });

        // Create status update handler
        const handleStatusUpdate = (data: PusherStatusUpdatePayload) => {
          if (!isActive) return;

          logRef.current("[PUSHER] Received status update:", data);

          // Validate payload
          if (!data.payment_id || !data.status) {
            logRef.current("[PUSHER] Invalid status update payload:", data);
            return;
          }

          // Only process payout completed status
          if (data.status === PaymentStatus.PaymentPayoutCompleted) {
            setLastStatusUpdate(data);

            // Trigger callback using ref
            if (onPayoutCompletedRef.current) {
              onPayoutCompletedRef.current(data);
            }
          } else {
            logRef.current(
              `[PUSHER] Ignoring status update (not payout completed):`,
              data.status
            );
          }
        };

        statusUpdateHandlerRef.current = handleStatusUpdate;

        // Bind to status-update event
        channel.bind("status-update", handleStatusUpdate);

        logRef.current(
          `[PUSHER] Listening for status updates on channel: ${channelName}`
        );
      } catch (error) {
        if (isActive) {
          // Handle case where pusher-js is not installed
          if (
            error instanceof Error &&
            (error.message.includes("Cannot find module") ||
              error.message.includes("Failed to resolve"))
          ) {
            logRef.current(
              "[PUSHER] pusher-js not installed. Install it as a peer dependency to enable Pusher integration."
            );
          } else {
            logRef.current("[PUSHER] Failed to initialize:", error);
          }
          setIsConnected(false);
        }
      }
    };

    initializePusher();

    // Cleanup function
    return () => {
      isActive = false;

      if (channelRef.current && statusUpdateHandlerRef.current) {
        try {
          channelRef.current.unbind(
            "status-update",
            statusUpdateHandlerRef.current
          );
          channelRef.current.unsubscribe();
        } catch (error) {
          logRef.current("[PUSHER] Error during channel cleanup:", error);
        }
        channelRef.current = null;
        statusUpdateHandlerRef.current = null;
      }

      if (pusherRef.current) {
        try {
          pusherRef.current.disconnect();
        } catch (error) {
          logRef.current("[PUSHER] Error during Pusher disconnect:", error);
        }
        pusherRef.current = null;
      }

      setIsConnected(false);
    };
  }, [enabled, rozoPaymentId]);

  return {
    isConnected,
    lastStatusUpdate,
  };
};
