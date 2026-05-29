import { createContext, useContext, type ReactNode } from "react";
import type { PostHog } from "posthog-js";
import type { RozoEventName } from "../lib/analytics/events";

interface AnalyticsContextValue {
  capture: (event: RozoEventName, properties?: Record<string, unknown>) => void;
}

const noop = () => {};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  capture: noop,
});

interface AnalyticsProviderProps {
  children: ReactNode;
  /** Optional PostHog instance from host app. If omitted, all analytics are no-ops. */
  posthog?: PostHog;
}

const SDK_APP_NAME = "intent-sdk";

export function AnalyticsProvider({ children, posthog }: AnalyticsProviderProps) {
  const value: AnalyticsContextValue = posthog
    ? {
        capture: (event, props) =>
          posthog.capture(event, { app_name: SDK_APP_NAME, ...props }),
      }
    : { capture: noop };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
