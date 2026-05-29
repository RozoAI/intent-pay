# Analytics Integration

Intent Pay SDK emits payment analytics events through an optional PostHog instance you provide.
If you don't pass one, all tracking is a no-op — zero bundle impact.

---

## Quick Start

### 1. Install PostHog

```bash
npm install posthog-js
# or
pnpm add posthog-js
```

### 2. Initialize PostHog in your app

```ts
// lib/analytics.ts
import posthog from "posthog-js";

posthog.init("YOUR_POSTHOG_PROJECT_API_KEY", {
  api_host: "https://us.i.posthog.com",
  person_profiles: "identified_only",
});

export default posthog;
```

### 3. Pass the instance to `RozoPayProvider`

```tsx
import posthog from "./lib/analytics";
import { RozoPayProvider } from "@rozoai/intent-pay";

export default function App() {
  return (
    <RozoPayProvider
      posthog={posthog}
      // ... your other props
    >
      {children}
    </RozoPayProvider>
  );
}
```

That's it. All payment events fire automatically through your PostHog instance.

---

## No Analytics (default)

Omit the `posthog` prop — nothing changes, no PostHog bundle included:

```tsx
<RozoPayProvider>
  {children}
</RozoPayProvider>
```

---

## Events Tracked

All events fire automatically. You don't need to instrument anything else.

| Event | When | Key Properties |
|---|---|---|
| `payment_flow_started` | Modal opens | `amount`, `destination_chain`, `token` |
| `payment_method_selected` | User picks a payment method | `field`, `value`, `wallet_id` |
| `payment_confirmed` | User confirms token + amount | `payment_id`, `source_chain`, `token`, `amount` |
| `payment_quote_requested` | Quote fetch begins | `source_chain`, `token`, `amount`, `payment_id` |
| `payment_quote_received` | Quote returned successfully | `source_chain`, `token`, `payment_id`, `fee` |
| `payment_quote_failed` | Quote fetch error | `source_chain`, `token`, `error_message` |
| `payment_submitted` | Transaction submitted to chain | `payment_id`, `destination_chain` |
| `payment_completed` | Payment confirmed on-chain | `payment_id`, `amount`, `destination_chain` |
| `payment_failed` | Terminal failure | `payment_id`, `destination_chain` |
| `payment_cancelled` | User closes mid-flow or retries from error | `payment_id`, `last_state`, `reason` |
| `error_occurred` | Error page shown | `context`, `error_message`, `error_title`, `payment_id`, `can_retry` |

### `payment_cancelled` reasons

| `reason` value | Meaning |
|---|---|
| `"user"` | User closed modal or clicked Cancel on error page |
| `"retry"` | User clicked "Try Another Method" on error page |

---

## Identifying Users

Intent Pay does **not** call `posthog.identify()` automatically. Identity is your app's responsibility.

**Why:** A single user can connect EVM, Solana, and Stellar wallets simultaneously — three different
addresses. The SDK has no way to know which address represents the canonical user identity, and
calling `identify()` with the wrong address would fragment your user profiles in PostHog.

Call `identify()` yourself at the point where your app has a canonical user identity
(after auth, after wallet connect, after Privy session, etc.):

```ts
import posthog from "./lib/analytics";

// After your app resolves user identity
posthog.identify(userId, {
  wallet_address: evmAddress ?? solanaAddress ?? stellarAddress,
});
```

All subsequent `payment_*` events will be attributed to that user in PostHog.

---

## Using `useAnalytics` for Custom Events

If you need to fire additional events from within components that are children of `RozoPayProvider`,
use the exported `useAnalytics` hook:

```tsx
import { useAnalytics } from "@rozoai/intent-pay";

function MyComponent() {
  const { capture } = useAnalytics();

  const handleCustomAction = () => {
    capture("my_custom_event", {
      some_property: "value",
    });
  };

  return <button onClick={handleCustomAction}>Do something</button>;
}
```

`useAnalytics` returns a no-op `capture` if no `posthog` was passed to `RozoPayProvider` —
safe to call unconditionally.

---

## PostHog Setup Tips

### Same project as your app

Pass the same PostHog instance your app already uses. Payment events will appear alongside
your other product events, linked to the same user session.

### Separate project

If you want payment analytics isolated, initialize a second PostHog instance with a different
project key and pass only that to `RozoPayProvider`.

### App name property

Set an `app_name` property on your PostHog instance so you can filter payment events by app
in dashboards (useful if multiple apps use the same PostHog project):

```ts
posthog.init("YOUR_KEY", {
  api_host: "https://us.i.posthog.com",
  bootstrap: {
    // or use posthog.register() after init:
  },
});

posthog.register({ app_name: "your-app-name" });
```

---

## Suggested PostHog Insights

Once events are flowing, these insights answer the key product questions:

**Funnel — payment completion rate**
```
payment_flow_started → payment_confirmed → payment_submitted → payment_completed
```

**Most common failure reason**
> Breakdown `error_occurred` by `error_title`

**Quote reliability**
> `payment_quote_failed` / `payment_quote_requested` ratio, breakdown by `source_chain`

**Time to complete**
> Duration between `payment_submitted` and `payment_completed`, breakdown by `destination_chain`

**Abandonment vs retry**
> `payment_cancelled` breakdown by `reason` (`"user"` vs `"retry"`)

**Method preference**
> `payment_method_selected` breakdown by `value` (`evm`, `solana`, `stellar`, `unconnected_wallet`)
