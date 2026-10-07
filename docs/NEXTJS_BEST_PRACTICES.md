# Next.js Best Practices — `RozoPayProvider`

A short, opinionated checklist for integrating `@rozoai/intent-pay` in a Next.js app.
For the full walkthrough (cookie flash-fix, `dynamic` fallback, Pages Router, non-Next.js apps),
see [`PROVIDER_SETUP.md`](./PROVIDER_SETUP.md). This page is the "what should I actually do" summary.

---

## TL;DR

1. Put `RozoPayProvider` + `WagmiProvider` in a **client component** (`"use client"`), never in a Server Component.
2. Build `wagmi`'s `config` with `createConfig` **inside `useState(() => ...)`**, not at module scope.
3. Pass `ssr: true` to `getDefaultConfig` — required for any App Router usage.
4. Only **one** `RozoPayProvider` per app, mounted once near the root layout.
5. If you're embedded in a wallet's in-app browser (Base App, MetaMask, Phantom), add cookie-based `initialState` too — `ssr: true` alone won't stop the reconnect flash there.

---

## 1. Client boundary

`RozoPayProvider`, `WagmiProvider`, and `getDefaultConfig`/`createConfig` all rely on browser-only wallet SDKs. Isolate them behind `"use client"` in a dedicated `providers.tsx`, and keep your root `layout.tsx` a plain Server Component that just renders `<Providers>{children}</Providers>`.

```tsx
// app/providers.tsx
"use client";

import { getDefaultConfig, RozoPayProvider } from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(() =>
    createConfig(getDefaultConfig({ appName: "Your App", ssr: true }))
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

```tsx
// app/layout.tsx — stays a Server Component
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

## 2. Don't build `config` at module scope

```tsx
// ❌ evaluated during SSR module load — some wallet connectors touch
// window/localStorage at construction time and will throw on the server
const config = createConfig(getDefaultConfig({ appName: "My App" }));

// ✅ deferred to client render via useState initializer
const [config] = useState(() =>
  createConfig(getDefaultConfig({ appName: "My App", ssr: true }))
);
```

`"use client"` marks a module boundary, but Next.js still evaluates that module on the server once (for the RSC payload). Module-scope `createConfig` runs there too — `useState(() => ...)` guarantees it only runs on the client, on first render.

If a wallet SDK still throws on import even inside `"use client"`, fall back to lazy-loading the whole provider tree with `next/dynamic({ ssr: false })` (see [PROVIDER_SETUP.md § Alternative Pattern](./PROVIDER_SETUP.md#alternative-pattern--dynamic-with-ssr-false)).

## 3. `ssr: true` is required, but it's not the whole story

`ssr: true` tells wagmi to render a deterministic "disconnected" state on the server so client hydration matches — it prevents the classic React hydration mismatch error. It does **not** make wagmi know a wallet was already connected before first paint.

If your users mostly open the app from a normal browser tab, `ssr: true` alone is enough — they'll see a brief "disconnected" flash for a few hundred ms while wagmi's `reconnect()` resolves, which is normal and unavoidable client-side.

If your users open the app **inside a wallet's in-app browser** (Base App, MetaMask, Phantom), that flash is more noticeable because the SDK waits for reconnect to settle before auto-navigating to the token list. Fix it with cookie-persisted `initialState`:

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

  return <WagmiProvider config={config} initialState={initialState}>{/* ... */}</WagmiProvider>;
}
```

```tsx
// app/layout.tsx (Server Component)
import { cookieToInitialState } from "wagmi";
import { headers } from "next/headers";
import { Providers } from "./providers";
import { config } from "./wagmi-config"; // same config shape as above

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

This is a consumer-app configuration choice — cookies are read on your server, so the SDK can't do it for you. See [PROVIDER_SETUP.md § Minimizing the Wallet Reconnect Flash](./PROVIDER_SETUP.md#minimizing-the-wallet-reconnect-flash-in-app-browsers) for the full explanation of the race condition this closes.

## 4. Mount `RozoPayProvider` exactly once

The provider throws at render time if it detects a second, nested instance:

```
Error: Multiple, nested usages of RozoPayProvider detected. Please use only one.
```

Mount it once, at (or near) the root layout. Don't wrap individual pages or route groups in their own `RozoPayProvider` — compose all pages under the single root instance instead.

It also requires a `WagmiProvider` ancestor; if missing, it logs a warning and renders `children` without payment functionality rather than crashing:

```
[RozoPay] RozoPayProvider must be within a WagmiProvider
```

## 5. Hooks and components only work inside the provider tree

`useRozoPayUI()`, `useRozoPayStatus()`, and `<RozoPayButton />` all read from `RozoPayProvider`'s context and throw (`useRozoPayUI must be used within a RozoPayProvider`) or fail to render correctly if used outside it. Keep them in components rendered under `<Providers>` in your layout tree — this is automatic for anything inside `app/**/page.tsx` once `Providers` wraps `{children}` at the root.

## Quick checklist before shipping

- [ ] `providers.tsx` has `"use client"` at the top
- [ ] `createConfig(...)` is inside `useState(() => ...)`, not at module scope
- [ ] `getDefaultConfig({ ssr: true, ... })`
- [ ] Exactly one `<RozoPayProvider>` in the whole app
- [ ] `layout.tsx` (or equivalent root) stays a Server Component and only renders `<Providers>{children}</Providers>`
- [ ] If targeting in-app wallet browsers: cookie `storage` + `initialState` wired through `layout.tsx`
- [ ] Swapped `appId="rozoSandbox"` for your own production `appId` before launch

---

For prop-level reference (`apiVersion`, `payApiUrl`, `stellarKit`, `debugMode`, theme/mode, etc.), see the [Props Reference table in PROVIDER_SETUP.md](./PROVIDER_SETUP.md#props-reference). For `RozoPayButton` props, see [ROZO_PAY_BUTTON_PROPS.md](./ROZO_PAY_BUTTON_PROPS.md).
