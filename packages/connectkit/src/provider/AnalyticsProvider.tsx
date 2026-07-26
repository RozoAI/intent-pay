import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { POSTHOG_HOST, POSTHOG_KEY } from "../constants/rozoConfig";
import type { RozoEventName } from "../lib/analytics/events";
import { isDNTEnabled } from "../utils/isDNTEnabled";
import { sanitizeProperties } from "../utils/sanitize";

interface AnalyticsContextValue {
  capture: (event: RozoEventName, properties?: Record<string, unknown>) => void;
}

/** Minimal PostHog interface — only capture() is needed. Any posthog-js version works. */
interface PostHogCapture {
  capture: (event: string, properties?: Record<string, unknown>) => void;
  /** Set by posthog-js after posthog.init() completes. Used to guard against uninitialized captures. */
  __loaded?: boolean;
}

/** Minimal posthog-js init interface for built-in telemetry. */
interface PostHogFull extends PostHogCapture {
  init: (
    key: string,
    options: {
      api_host: string;
      person_profiles: string;
      capture_pageview: boolean;
      capture_pageleave: boolean;
      autocapture: boolean;
      disable_session_recording: boolean;
      persistence: string;
    },
    // Named-instance form: posthog-js keys instances by `name` off its
    // internal registry instead of mutating the shared default singleton.
    // Required here — see call site below.
    name?: string,
  ) => PostHogFull;
  opt_out_capturing: () => void;
}

const noop = () => {};

const AnalyticsContext = createContext<AnalyticsContextValue>({
  capture: noop,
});

// Module-level cache for the named telemetry instance. AnalyticsProvider
// remounts whenever a host app remounts its provider tree (e.g. a
// per-route layout that wraps RozoPayProvider fresh on each client-side
// navigation) — without this, the effect below would call posthog-js's
// named-instance init() again on every remount. Re-init on an existing
// name logs "You have already initialized PostHog!" and is a no-op, but
// the console warning is still spurious noise for host apps. Reusing the
// cached instance across remounts avoids the duplicate init call entirely.
let cachedBuiltin: unknown = null;

const SDK_APP_NAME = "rozo-intent-sdk";

/** Properties stripped from built-in telemetry — host app receives them unchanged. */
const BUILTIN_STRIP_KEYS: ReadonlySet<string> = new Set([
  "payment_id",
  "tx_hash",
  "amount",
]);

interface AnalyticsProviderProps {
  children: ReactNode;
  /**
   * Enable built-in SDK telemetry. Tracks anonymous payment funnel events
   * using the SDK's own PostHog project. Does NOT track addresses, amounts,
   * or tx hashes. Respects browser Do Not Track. Default: true.
   *
   * Set to false to fully disable all built-in tracking.
   */
  telemetry?: boolean;
  /** Optional PostHog instance from host app. If omitted, only built-in telemetry fires (if enabled). */
  posthog?: PostHogCapture;
}

export function AnalyticsProvider({
  children,
  telemetry = true,
  posthog: hostPosthog,
}: AnalyticsProviderProps) {
  const builtinRef = useRef<PostHogFull | null>(null);
  const telemetryEnabled = telemetry && !isDNTEnabled();

  useEffect(() => {
    if (!telemetryEnabled) return;

    // Reuse the cached instance across remounts instead of calling init()
    // again — see cachedBuiltin comment above.
    if (cachedBuiltin) {
      builtinRef.current = cachedBuiltin as PostHogFull;
      return;
    }

    // Lazy-load posthog-js only when telemetry is on. It's a peer dep so
    // we try/catch — if the host app didn't install it, built-in telemetry
    // silently no-ops rather than crashing.
    //
    // Use the NAMED-instance init form (3rd arg), not the default export
    // directly. `import("posthog-js").then(mod => mod.default)` resolves to
    // the SAME module-level singleton the host app's own `posthog.init()`
    // uses (same package, same version = one module instance). Calling
    // .init() again on that default instance with the SDK's own key mutates
    // (or, once loaded, silently no-ops on) whatever config the host
    // already set — so this telemetry either overwrites the host's PostHog
    // client or gets dropped entirely, depending on init order. The named
    // form creates/reuses an isolated instance keyed by `name`, fully
    // independent of the host's default client and of any other named
    // instance, so this SDK's telemetry always uses ITS OWN key/config
    // regardless of what else has called posthog.init() on this page.
    let cancelled = false;
    import("posthog-js")
      .then((mod) => {
        if (cancelled) return;
        const ph = mod.default as unknown as PostHogFull;
        const builtin = ph.init(
          POSTHOG_KEY,
          {
            api_host: POSTHOG_HOST,
            person_profiles: "identified_only",
            capture_pageview: false,
            capture_pageleave: false,
            autocapture: false,
            disable_session_recording: true,
            persistence: "memory",
          },
          "rozo-sdk-telemetry",
        );
        cachedBuiltin = builtin;
        builtinRef.current = builtin;
      })
      .catch(() => {
        // posthog-js not installed — built-in telemetry silently disabled
      });

    return () => {
      cancelled = true;
    };
  }, [telemetryEnabled]);

  const value: AnalyticsContextValue = {
    capture: (event, props = {}) => {
      const safe = sanitizeProperties({ app_name: SDK_APP_NAME, ...props });

      // Built-in SDK telemetry — strip identifying fields
      if (telemetryEnabled && builtinRef.current?.__loaded) {
        const stripped = Object.fromEntries(
          Object.entries(safe).filter(([k]) => !BUILTIN_STRIP_KEYS.has(k)),
        );
        builtinRef.current.capture(event, stripped);
      }

      // Host app PostHog — receives full sanitized props (host owns their data policy)
      if (hostPosthog) {
        if (!hostPosthog.__loaded) return;
        hostPosthog.capture(event, safe);
      }
    },
  };

  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalytics() {
  return useContext(AnalyticsContext);
}
