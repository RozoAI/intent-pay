# Enable Cookie-Based Wallet Reconnect (RozoPay + Wagmi + Next.js)

Copy-paste guide. Fixes: wallet apps (Base App, MetaMask, Phantom in-app browser) showing the method-picker screen instead of auto-connecting on first load.

## 3 edits

### 1. `app/providers.tsx`

```tsx
"use client";

import { getDefaultConfig, RozoPayProvider } from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  cookieStorage,
  cookieToInitialState,
  createConfig,
  createStorage,
  WagmiProvider,
  type State,
} from "wagmi";

const queryClient = new QueryClient();

export function Providers({
  children,
  cookie,
}: {
  children: ReactNode;
  cookie?: string | null;
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
  const initialState = cookieToInitialState(config, cookie);

  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider>{children}</RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

### 2. `app/layout.tsx` (server component — must NOT have `"use client"`)

```tsx
import { headers } from "next/headers";
import { Providers } from "./providers";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookie = (await headers()).get("cookie");

  return (
    <html lang="en">
      <body>
        <Providers cookie={cookie}>{children}</Providers>
      </body>
    </html>
  );
}
```

### 3. Force dynamic rendering (top of `layout.tsx`)

```tsx
export const dynamic = "force-dynamic";
```

Required — without this, Next.js may statically render the layout and `headers()` returns nothing useful, or build fails since `headers()` opts into dynamic rendering anyway. Setting it explicitly avoids surprises.

## Checklist

- [ ] `providers.tsx` accepts `cookie` prop, passes `ssr: true` + `storage: createStorage({ storage: cookieStorage })` into `getDefaultConfig`
- [ ] `initialState = cookieToInitialState(config, cookie)` passed to `<WagmiProvider initialState={...}>`
- [ ] `layout.tsx` is a server component (`async function`, no `"use client"`), reads `headers().get("cookie")`, passes to `<Providers cookie={cookie}>`
- [ ] `export const dynamic = "force-dynamic"` set in `layout.tsx`

## Why

wagmi's `reconnect()` starts every page load at `isConnected: false`, restores session async. SDK can't auto-jump to the connected wallet's tokens until that resolves — so in-app browsers flash the method-picker first. Cookie `initialState` makes wagmi know the connection state before first paint, closing that gap.

Not Next.js (Vite/CRA/SPA)? Skip all of this — no SSR means no pre-paint mismatch to fix. Just `createConfig` normally, no `ssr`/cookie storage needed.

Full details: [PROVIDER_SETUP.md § Minimizing the Wallet Reconnect Flash](./PROVIDER_SETUP.md#minimizing-the-wallet-reconnect-flash-in-app-browsers)
