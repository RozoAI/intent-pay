import { createContext, useContext, type ReactNode } from "react";
import type { RozoEventName } from "../lib/analytics/events";

interface AnalyticsContextValue {
  capture: (event: RozoEventName, properties?: Record<string, unknown>) => void;
}

/** Minimal PostHog interface — only capture() is needed. Any posthog-js version works. */
interface PostHogCapture {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  /** Set by posthog-js after posthog.init() completes. Used to guard against uninitialized captures. */
  __loaded?: boolean;
}

const noop = () => {};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  capture: noop,
});

interface AnalyticsProviderProps {
  children: ReactNode;
  /** Optional PostHog instance from host app. If omitted, all analytics are no-ops. */
  posthog?: PostHogCapture;
}

const SDK_APP_NAME = "intent-sdk";

export function AnalyticsProvider({
  children,
  posthog,
}: AnalyticsProviderProps) {
  const value: AnalyticsContextValue = posthog
    ? {
        capture: (event, props) => {
          if (!posthog.__loaded) return;
          posthog.capture(event, { app_name: SDK_APP_NAME, ...props });
        },
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
