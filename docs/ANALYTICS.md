# Analytics & Telemetry

Intent Pay SDK ships with two independent analytics channels:

| Channel                    | Who controls it   | Default                            |
| -------------------------- | ----------------- | ---------------------------------- |
| **Built-in SDK telemetry** | RozoAI (this SDK) | **On** (opt-out)                   |
| **Host-app PostHog**       | You (integrator)  | Off unless you pass `posthog` prop |

---

## Built-in SDK Telemetry

The SDK sends anonymous payment funnel events to RozoAI's PostHog project. This helps us understand how the payment flow performs across integrations so we can improve it.

### What IS tracked

| Event                      | When                       | Properties sent                                      |
| -------------------------- | -------------------------- | ---------------------------------------------------- |
| `payment_flow_started`     | Modal opens                | `destination_chain`, `app_name`                      |
| `payment_method_selected`  | User picks payment method  | `field`, `value`, `wallet_id`, `app_name`            |
| `payment_quote_requested`  | Quote fetch begins         | `source_chain`, `app_name`                           |
| `payment_quote_received`   | Quote returned             | `source_chain`, `fee`, `app_name`                    |
| `payment_quote_failed`     | Quote fetch error          | `source_chain`, `error_type`, `app_name`             |
| `payment_confirmed`        | User confirms payment      | `source_chain`, `destination_chain`, `app_name`      |
| `payment_submitted`        | Transaction sent           | `destination_chain`, `app_name`                      |
| `payment_completed`        | On-chain confirmed         | `destination_chain`, `app_name`                      |
| `payment_failed`           | Terminal failure           | `error_type`, `destination_chain`, `app_name`        |
| `payment_cancelled`        | Modal closed mid-flow      | `last_state`, `reason`, `app_name`                   |
| `error_occurred`           | Error page shown           | `error_type`, `error_title`, `can_retry`, `app_name` |
| `payment_validation_error` | Invalid chain/token config | `error_type`, `app_name`                             |

### What is NEVER sent

- **Wallet addresses** (EVM, Solana, Stellar)
- **Token amounts** or USD values
- **Transaction hashes**
- **Payment IDs** (`payment_id`, internal Rozo order IDs)
- **Error messages** containing any of the above
- **Personal identifiers** (name, email)
- **Page URLs or referrers**

Every string property is run through a sanitizer before dispatch that replaces any pattern matching an address, tx hash, or numeric amount with `[address]`, `[tx_hash]`, or `[amount]` respectively. If something slips through the sanitizer, please [open an issue](https://github.com/RozoAI/intent-pay/issues).

### PostHog configuration for built-in telemetry

The built-in client is initialized with:

```ts
{
  person_profiles: "identified_only",  // no anonymous profiles created
  capture_pageview: false,
  capture_pageleave: false,
  autocapture: false,                  // no DOM click capture
  disable_session_recording: true,
  persistence: "memory",              // no localStorage/cookies
}
```

### Opting out

**Per integration** — pass `telemetry={false}` to `RozoPayProvider`:

```tsx
<RozoPayProvider telemetry={false} ...>
  {children}
</RozoPayProvider>
```

**Browser-level** — the SDK respects the browser's [Do Not Track](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/doNotTrack) setting. If `navigator.doNotTrack === "1"`, built-in telemetry is automatically disabled with no extra configuration needed.

---

## Host-App PostHog (optional)

Pass your own PostHog instance to receive the same payment events in your own project:

### 1. Install PostHog

```bash
pnpm add posthog-js
```

### 2. Initialize in your app

```ts
// lib/analytics.ts
import posthog from "posthog-js";

posthog.init("YOUR_POSTHOG_PROJECT_API_KEY", {
  api_host: "https://us.i.posthog.com",
  person_profiles: "identified_only",
});

export default posthog;
```

### 3. Pass to `RozoPayProvider`

```tsx
import posthog from "./lib/analytics";
import { RozoPayProvider } from "@rozoai/intent-pay";

export default function App() {
  return (
    <RozoPayProvider posthog={posthog} ...>
      {children}
    </RozoPayProvider>
  );
}
```

All payment events fire through your instance too. The same sanitization applies — no addresses, amounts, or hashes reach your PostHog project either.

### No host analytics (default)

Omit the `posthog` prop. Only built-in telemetry fires (unless you disabled that too).

```tsx
<RozoPayProvider>{children}</RozoPayProvider>
```

---

## Identifying Users

Intent Pay does **not** call `posthog.identify()` automatically. Identity is your app's responsibility.

**Why:** A single user can connect EVM, Solana, and Stellar wallets simultaneously. The SDK has no way to know which address is the canonical user identity, and calling `identify()` with the wrong address would fragment your user profiles.

Call `identify()` yourself after your app resolves user identity:

```ts
posthog.identify(userId, {
  // safe to omit wallet_address here — SDK strips it from events anyway
});
```

---

## Custom Events from Components

Use `useAnalytics` to fire additional events from components inside `RozoPayProvider`:

```tsx
import { useAnalytics } from "@rozoai/intent-pay";

function MyComponent() {
  const { capture } = useAnalytics();

  return (
    <button onClick={() => capture("my_custom_event", { source: "banner" })}>
      Pay now
    </button>
  );
}
```

`capture` is a no-op when both telemetry is off and no host PostHog is provided.

---

## Suggested PostHog Insights

### Funnel — payment completion rate

```text
payment_flow_started → payment_confirmed → payment_submitted → payment_completed
```

### Most common failure type

> Breakdown `error_occurred` by `error_title`

### Quote reliability by chain

> `payment_quote_failed` / `payment_quote_requested` ratio, breakdown by `source_chain`

### Abandonment vs retry

> `payment_cancelled` breakdown by `reason` (`"user"` vs `"retry"`)

### Method preference

> `payment_method_selected` breakdown by `value` (`evm`, `solana`, `stellar`, `unconnected_wallet`)
