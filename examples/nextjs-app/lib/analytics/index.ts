import posthog from "posthog-js";
import type { RozoEventName } from "./events";

export function capture(event: RozoEventName, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  posthog.capture(event, properties);
}

export function identifyUser(walletAddress: string, properties?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  posthog.identify(walletAddress.toLowerCase(), {
    wallet_address: walletAddress.toLowerCase(),
    ...properties,
  });
}

export function resetUser() {
  if (typeof window === "undefined") return;
  posthog.reset();
}

export { ROZO_EVENTS, APP_NAME } from "./events";
