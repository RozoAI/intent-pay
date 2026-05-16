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
