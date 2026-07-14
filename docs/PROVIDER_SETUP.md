# RozoPayProvider Setup Guide

Correct provider setup prevents hydration flashes and ensures hooks like `useRozoPayUI` work immediately.

---

## Recommended Pattern — Next.js App Router

**Step 1: Create a client providers file**

```tsx
// app/providers.tsx
"use client";

import {
  getDefaultConfig,
  RozoPayProvider,
} from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";

export function Providers({ children }: { children: ReactNode }) {
  // createConfig inside useState — runs client-only, avoids SSR module-level side effects
  const [config] = useState(() =>
    createConfig(
      getDefaultConfig({
        appName: "Your App",
        ssr: true,
      })
    )
  );
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider>{children}</RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

**Step 2: Use in your root layout (server component)**

```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 3: Use SDK hooks and components anywhere below**

```tsx
// app/checkout/page.tsx
"use client";

import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";

export default function CheckoutPage() {
  // Works immediately — no flash, no context errors
  const { resetPayment } = useRozoPayUI();

  return (
    <RozoPayButton
      appId="your-app-id"
      toChain={8453}
      toAddress="0x..."
      toToken="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
      toUnits="1000000"
      onPaymentCompleted={(e) => console.log(e)}
    />
  );
}
```

---

## Minimizing the Wallet Reconnect Flash (In-App Browsers)

`ssr: true` above only stops SSR hydration mismatches — it does **not** make wagmi know a wallet is connected before first paint. On every page load, wagmi's `reconnect()` and the Solana adapter's `autoConnect` both start from `isConnected: false`/`connected: false` and asynchronously restore the session (iterating connectors, calling `isAuthorized()`, waiting for wallet-standard `readyStateChange` events). The SDK waits for this to settle before auto-navigating to the token list, so during that window users opening the app inside a wallet's in-app browser (MetaMask, Base App, Phantom) can briefly see the method-selection screen instead of jumping straight to their tokens.

To shortcut this, persist the connection in cookies server-side and pass it as `initialState` so wagmi already knows the wallet is connected on the very first render:

```tsx
// app/providers.tsx
"use client";
import { cookieStorage, createConfig, createStorage, WagmiProvider, type State } from "wagmi";

export function Providers({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState?: State;
}) {
  const [config] = useState(() =>
    createConfig(
      getDefaultConfig({
        appName: "Your App",
        ssr: true,
        storage: createStorage({ storage: cookieStorage }),
      })
    )
  );

  return (
    <WagmiProvider config={config} initialState={initialState}>
      {/* ... */}
    </WagmiProvider>
  );
}
```

```tsx
// app/layout.tsx (server component)
import { cookieToInitialState } from "wagmi";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { config } from "./wagmi-config"; // export the same config used above

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialState = cookieToInitialState(config, (await headers()).get("cookie"));
  return (
    <html>
      <body>
        <Providers initialState={initialState}>{children}</Providers>
      </body>
    </html>
  );
}
```

Without this, every page load pays the full reconnect race — `ssr: true` alone does not close it. This is a consumer-app configuration choice, not something the SDK can do on your behalf, since cookies are read on your server.

### Non-Next.js / SPA apps (Vite, CRA, plain React)

No SSR means no server-rendered HTML to mismatch, so `ssr: true` and cookie `initialState` don't apply — there's nothing to hydrate against. The reconnect race is still real client-side though: wagmi's `reconnect()` starts at `isConnected: false` on every load and resolves async, same as Next.js. Skip the cookie machinery and just `createConfig` normally:

```tsx
// providers.tsx
import { getDefaultConfig, RozoPayProvider } from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";

const config = createConfig(
  getDefaultConfig({
    appName: "Your App",
  })
);
const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider>{children}</RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

`createConfig` can live at module scope here — there's no SSR module-evaluation pass to trip over (see "Common Mistakes" below, which is Next.js-specific). The SDK's own `status === "reconnecting"` gate (see Race A notes in `CLAUDE.md`) still covers the auto-navigate flash; there's just no extra cookie step to add since there's no server to read them on.

---

## Alternative Pattern — `dynamic` with `ssr: false`

Use this when wallet SDKs have module-level side effects that throw on import during SSR (e.g. accessing `window` or `localStorage` at import time).

```tsx
// app/providers-wrapper.tsx
"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Providers = dynamic(
  () => import("./providers").then((mod) => ({ default: mod.Providers })),
  { ssr: false }
);

export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
```

Then use `ProvidersWrapper` in your layout instead of `Providers`.

---

## Common Mistakes

### ❌ `createConfig` at module level with `"use client"`

```tsx
"use client";

// WRONG: runs during SSR module evaluation
const config = createConfig(getDefaultConfig({ appName: "My App" }));

export function Providers({ children }) {
  return (
    <WagmiProvider config={config}>
      <RozoPayProvider>{children}</RozoPayProvider>
    </WagmiProvider>
  );
}
```

**Why it fails:** Next.js evaluates `"use client"` module boundaries on the server too. `createConfig` may access browser APIs at init time and throw.

**Fix:** Move `createConfig` inside `useState(() => ...)` as shown in the recommended pattern, or use `dynamic({ ssr: false })`.

---

### ❌ Nesting `RozoPayProvider` more than once

```tsx
// WRONG: nested providers cause state collision errors
<RozoPayProvider>
  <RozoPayProvider> {/* throws: "Multiple, nested usages detected" */}
    <App />
  </RozoPayProvider>
</RozoPayProvider>
```

**Fix:** One `RozoPayProvider` at app root only.

---

### ⚠️ SSR `ReferenceError: window is not defined` from telemetry (fixed in 0.1.36+)

Before 0.1.36, the SDK's `isDNTEnabled()` telemetry guard touched
`window.doNotTrack` unconditionally. Under Next.js SSR, `window` is undefined,
so rendering `<RozoPayProvider>` on the server threw and returned HTTP 500 for
the entire page.

**Workaround (older SDK versions):** pass `telemetry={false}` to disable the
built-in telemetry path.

```tsx
<RozoPayProvider telemetry={false} ...>
```

**On 0.1.36+:** the guard is SSR-safe (`typeof window === "undefined"` short-
circuits before any `window.*` access). Host apps can drop the
`telemetry={false}` workaround unless they want to opt out of telemetry for
privacy reasons — see [ANALYTICS.md](./ANALYTICS.md#opting-out).

---

### ❌ Using SDK hooks outside the provider

```tsx
// WRONG: useRozoPayUI throws if called outside RozoPayProvider
export default function Page() {
  const { resetPayment } = useRozoPayUI(); // throws
  return <div />;
}
```

**Fix:** Ensure `Page` is rendered as a child of `RozoPayProvider`.

---

## Props Reference

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiVersion` | `"v1" \| "v2"` | `"v2"` | Payment API version |
| `payApiUrl` | `string` | `"https://intentapi.rozo.ai"` | Override API base URL (staging/test) |
| `solanaRpcUrl` | `string` | QuikNode mainnet | Custom Solana RPC endpoint |
| `stellarRpcUrl` | `string` | — | Custom Stellar RPC endpoint |
| `stellarKit` | `StellarWalletsKit` | — | External Stellar kit instance (avoids custom element conflicts) |
| `stellarWalletPersistence` | `boolean` | `false` | Persist Stellar wallet in `localStorage` |
| `debugMode` | `boolean` | `false` | Log payment events to console |
| `theme` | `Theme` | `"auto"` | UI theme |
| `mode` | `Mode` | `"auto"` | Light/dark mode |

For `RozoPayButton` props, see [ROZO_PAY_BUTTON_PROPS.md](./ROZO_PAY_BUTTON_PROPS.md).

---

## Framework Notes

### Vite / Create React App

No SSR concerns — use providers directly without `"use client"` or `dynamic`:

```tsx
// main.tsx
import { createConfig, WagmiProvider } from "wagmi";
import { getDefaultConfig, RozoPayProvider } from "@rozoai/intent-pay";

const config = createConfig(getDefaultConfig({ appName: "My App" }));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <WagmiProvider config={config}>
    <QueryClientProvider client={new QueryClient()}>
      <RozoPayProvider>
        <App />
      </RozoPayProvider>
    </QueryClientProvider>
  </WagmiProvider>
);
```

### Next.js Pages Router

Same as Vite — no App Router SSR complications. Wrap in `_app.tsx`:

```tsx
// pages/_app.tsx
export default function App({ Component, pageProps }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider>
          <Component {...pageProps} />
        </RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```
