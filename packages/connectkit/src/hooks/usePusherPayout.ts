import { PaymentStatus } from "@rozoai/intent-common";
import Pusher from "pusher-js";
import { useEffect, useRef, useState } from "react";
import { PayLogFn } from "../provider/PayContext";

// Pusher types - defined here to avoid requiring pusher-js types
interface PusherChannel {
  bind(event: string, callback: (data: any) => void): void;
  unbind(event: string, callback?: (data: any) => void): void;
  unsubscribe(): void;
}

interface PusherStatusUpdatePayload {
  payment_id: string;
  status: PaymentStatus;
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
  /** Callback when payin is detected (source_txhash is received) */
  onPayinDetected?: (payload: PusherStatusUpdatePayload) => void;
  /** Callback when any data is received (to track activity) */
  onDataReceived?: () => void;
  /** Logging function */
  log: PayLogFn;
}

export interface UsePusherPayoutResult {
  /** Whether Pusher is connected */
  isConnected: boolean;
  /** Last received status update */
  lastStatusUpdate: PusherStatusUpdatePayload | null;
  /** Function to manually unsubscribe from Pusher */
  unsubscribe: () => void;
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
  const {
    enabled,
    rozoPaymentId,
    onPayoutCompleted,
    onPayinDetected,
    onDataReceived,
    log,
  } = options;

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastStatusUpdate, setLastStatusUpdate] =
    useState<PusherStatusUpdatePayload | null>(null);

  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<PusherChannel | null>(null);
  const statusUpdateHandlerRef = useRef<
    ((data: PusherStatusUpdatePayload) => void) | null
  >(null);
  const isActiveRef = useRef<boolean>(true);
  const subscribedChannelRef = useRef<string | null>(null);

  // Store callbacks in refs to prevent infinite loops
  const onPayoutCompletedRef = useRef(onPayoutCompleted);
  const onPayinDetectedRef = useRef(onPayinDetected);
  const onDataReceivedRef = useRef(onDataReceived);
  const logRef = useRef(log);

  // Update refs when callbacks change (without triggering re-renders)
  useEffect(() => {
    onPayoutCompletedRef.current = onPayoutCompleted;
    onPayinDetectedRef.current = onPayinDetected;
    onDataReceivedRef.current = onDataReceived;
    logRef.current = log;
  });

  // Unsubscribe function to manually disconnect Pusher
  const unsubscribe = () => {
    isActiveRef.current = false;

    if (channelRef.current && statusUpdateHandlerRef.current) {
      try {
        channelRef.current.unbind(
          "status-update",
          statusUpdateHandlerRef.current
        );
        channelRef.current.unsubscribe();
        logRef.current(
          "[PUSHER] Manual unsubscribe: Channel cleanup successful"
        );
      } catch (error) {
        logRef.current("[PUSHER] Error during manual channel cleanup:", error);
      }
      channelRef.current = null;
      statusUpdateHandlerRef.current = null;
    }

    if (pusherRef.current) {
      try {
        pusherRef.current.disconnect();
        logRef.current("[PUSHER] Manual unsubscribe: Pusher disconnected");
      } catch (error) {
        logRef.current(
          "[PUSHER] Error during manual Pusher disconnect:",
          error
        );
      }
      pusherRef.current = null;
    }

    subscribedChannelRef.current = null;
    setIsConnected(false);
  };

  useEffect(() => {
    logRef.current(
      `[PUSHER] Hook effect triggered - enabled: ${enabled}, rozoPaymentId: ${rozoPaymentId}`
    );

    // Early return if disabled or missing payment ID
    if (!enabled || !rozoPaymentId) {
      logRef.current(
        `[PUSHER] Skipping initialization - enabled: ${enabled}, rozoPaymentId: ${rozoPaymentId}`
      );
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
        // Only unsubscribe if we have a valid payment ID
        if (rozoPaymentId) {
          pusherRef.current.unsubscribe(`payments-${rozoPaymentId}`);
        }
        pusherRef.current.disconnect();
        pusherRef.current = null;
      }
      subscribedChannelRef.current = null;
      setIsConnected(false);
      return;
    }

    // Check if we're already subscribed to the same channel
    const channelName = `payments-${rozoPaymentId}`;
    if (
      subscribedChannelRef.current === channelName &&
      channelRef.current &&
      pusherRef.current
    ) {
      logRef.current(
        `[PUSHER] Already subscribed to channel: ${channelName}, skipping re-initialization`
      );
      return;
    }

    logRef.current(
      `[PUSHER] Initializing Pusher for payment ID: ${rozoPaymentId}`
    );

    // Dynamically import pusher-js to make it optional
    isActiveRef.current = true;

    const initializePusher = async () => {
      try {
        // Initialize Pusher client
        const pusher = new Pusher(PUSHER_CONFIG.key, {
          cluster: PUSHER_CONFIG.cluster,
        });

        if (!isActiveRef.current) {
          pusher.disconnect();
          return;
        }

        pusherRef.current = pusher as unknown as Pusher;

        // Subscribe to payment channel
        const channel = pusher.subscribe(channelName);

        if (!isActiveRef.current) {
          channel.unsubscribe();
          pusher.disconnect();
          return;
        }

        channelRef.current = channel as unknown as PusherChannel;
        subscribedChannelRef.current = channelName;

        // Handle connection state
        pusher.connection.bind("connected", () => {
          if (isActiveRef.current) {
            logRef.current("[PUSHER] Connected to Pusher");
            setIsConnected(true);
          }
        });

        pusher.connection.bind("disconnected", () => {
          if (isActiveRef.current) {
            logRef.current("[PUSHER] Disconnected from Pusher");
            setIsConnected(false);
          }
        });

        pusher.connection.bind("error", (err: any) => {
          if (isActiveRef.current) {
            logRef.current("[PUSHER] Connection error:", err);
            setIsConnected(false);
          }
        });

        // Handle subscription success
        channel.bind("pusher:subscription_succeeded", () => {
          if (isActiveRef.current) {
            logRef.current(`[PUSHER] Subscribed to channel: ${channelName}`);
          }
        });

        channel.bind("pusher:subscription_error", (err: any) => {
          if (isActiveRef.current) {
            logRef.current(
              `[PUSHER] Subscription error for channel ${channelName}:`,
              err
            );
          }
        });

        // Create status update handler
        const handleStatusUpdate = (data: PusherStatusUpdatePayload) => {
          if (!isActiveRef.current) return;

          logRef.current("[PUSHER] Received status update:", data);

          // Validate payload
          if (!data.payment_id || !data.status) {
            logRef.current("[PUSHER] Invalid status update payload:", data);
            return;
          }

          // Notify that data was received (for tracking activity)
          if (onDataReceivedRef.current) {
            onDataReceivedRef.current();
          }

          // Process payin detection (when source_txhash is received)
          if (data.source_txhash && onPayinDetectedRef.current) {
            logRef.current(
              "[PUSHER] Payin detected (source_txhash received):",
              data.source_txhash
            );
            onPayinDetectedRef.current(data);
          }

          // Process payout completed status
          if (data.status === PaymentStatus.PaymentPayoutCompleted) {
            setLastStatusUpdate(data);

            // Trigger callback using ref
            if (onPayoutCompletedRef.current) {
              onPayoutCompletedRef.current(data);
            }
          } else {
            logRef.current(`[PUSHER] Status update received:`, data.status);
          }
        };

        statusUpdateHandlerRef.current = handleStatusUpdate;

        // Bind to status-update event
        channel.bind("status-update", handleStatusUpdate);

        logRef.current(
          `[PUSHER] Successfully initialized and listening for status updates on channel: ${channelName}`
        );
      } catch (error) {
        if (isActiveRef.current) {
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

    // Cleanup function - only runs when dependencies change
    // Note: This cleanup runs before the new effect, so it cleans up the previous subscription
    return () => {
      // Store the current subscribed channel before cleanup
      const previousChannel = subscribedChannelRef.current;

      // Determine what channel we're moving to based on current (old) dependency values
      // This will be compared in the new effect to decide if we need to re-subscribe
      const currentChannelName =
        enabled && rozoPaymentId ? `payments-${rozoPaymentId}` : null;

      // Only cleanup if we have an active subscription
      // The new effect will check if it needs to subscribe to the same or different channel
      if (previousChannel) {
        // If we're staying on the same channel, don't cleanup - the new effect will skip re-initialization
        if (previousChannel === currentChannelName) {
          logRef.current(
            `[PUSHER] Same channel (${previousChannel}), skipping cleanup - will reuse existing subscription`
          );
          return;
        }

        // Different channel or disabling - cleanup is needed
        isActiveRef.current = false;

        if (channelRef.current && statusUpdateHandlerRef.current) {
          try {
            channelRef.current.unbind(
              "status-update",
              statusUpdateHandlerRef.current
            );
            channelRef.current.unsubscribe();
            logRef.current(
              `[PUSHER] Channel cleanup successful (${previousChannel} -> ${
                currentChannelName || "disabled"
              })`
            );
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

        subscribedChannelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [enabled, rozoPaymentId]);

  return {
    isConnected,
    lastStatusUpdate,
    unsubscribe,
  };
};
