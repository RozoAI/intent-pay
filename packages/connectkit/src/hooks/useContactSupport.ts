import React from "react";
import { rozoPayVersion } from "../utils/exports";
import { useRozoPay } from "./useDaimoPay";
import { usePayContext } from "./usePayContext";

/**
 * Hook to handle contact support functionality.
 * Returns a handler function that opens Intercom if available,
 * otherwise opens the support URL.
 *
 * @param preFilledMessage - Optional pre-filled message to include in the support request
 * @returns A handler function that can be used as an onClick handler
 */
export function useContactSupport(preFilledMessage?: string) {
  const context = usePayContext();
  const pay = useRozoPay();

  const handleContactClick = (event?: React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault();
    }

    if (
      typeof window !== "undefined" &&
      typeof window.Intercom === "function"
    ) {
      context.setOpen(false);
      window.Intercom(
        "showNewMessage",
        [
          "Hi, I need help with my payment.",
          "",
          `Version: ${rozoPayVersion}`,
          pay.order?.externalId
            ? `Order ID: ${pay.order.externalId.toString()}`
            : null,
          preFilledMessage,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } else {
      window.open(
        globalThis.__SUPPORTURL__ ||
          `https://pay.rozo.ai?ref=sdk-v${rozoPayVersion}`
      );
    }
  };

  return handleContactClick;
}
