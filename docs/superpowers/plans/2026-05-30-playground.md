# Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fresh `examples/playground` Next.js 16 app with shadcn/ui that lets developers configure and test Bridge, Online Checkout, and Wallet Deposit payment flows with live `RozoPayButton` and copyable code snippets.

**Architecture:** Single-page app with a 2-column layout (sidebar param form + main preview/code tabs). Three scenario modes share a common param form but differ in how they invoke the SDK. Config persists to localStorage per scenario. No modals — everything inline.

**Tech Stack:** Next.js 16.2.6 (App Router), Tailwind v4, shadcn/ui (new-york style, dark mode), TypeScript, `@rozoai/intent-pay@0.1.22`, `@rozoai/intent-common@0.1.17`, Wagmi v2, @tanstack/react-query v5, react-syntax-highlighter.

---

## File Map

```
examples/playground/
├── package.json
├── tsconfig.json
├── next.config.ts
├── components.json                         # shadcn config
├── src/
│   ├── app/
│   │   ├── globals.css                     # Tailwind v4 + shadcn tokens, Geist font
│   │   ├── layout.tsx                      # html/body, font vars on <html>, providers
│   │   ├── page.tsx                        # 2-col layout shell, scenario state
│   │   └── providers.tsx                   # WagmiProvider + QueryClient + RozoPayProvider
│   ├── components/
│   │   ├── ScenarioTabs.tsx                # Bridge / Online Checkout / Wallet Deposit tabs
│   │   ├── ParamForm.tsx                   # Chain+token+address+amount fields (shared)
│   │   ├── BridgeMode.tsx                  # resetPayment flow + RozoPayButton.Custom
│   │   ├── CheckoutMode.tsx                # createPayment + paymentId + keyed remount
│   │   ├── DepositMode.tsx                 # like Bridge, no toUnits field
│   │   ├── PreviewPane.tsx                 # Tabs: Preview | Code
│   │   ├── CodeSnippet.tsx                 # syntax-highlighted snippet + copy button
│   │   └── EventLog.tsx                    # onPaymentStarted/Completed/Payout feed
│   ├── hooks/
│   │   └── usePlaygroundConfig.ts          # localStorage r/w per scenario key
│   └── lib/
│       ├── snippets.ts                     # generateBridgeSnippet / Checkout / Deposit
│       └── chains.ts                       # chain+token selector helpers from intent-common
```

---

## Task 1: Scaffold package.json and project config

**Files:**
- Create: `examples/playground/package.json`
- Create: `examples/playground/tsconfig.json`
- Create: `examples/playground/next.config.ts`
- Modify: `pnpm-workspace.yaml` — add `examples/playground`
- Modify: root `package.json` — add `dev:playground` script

- [ ] **Step 1: Create `examples/playground/package.json`**

```json
{
  "name": "playground",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@rozoai/intent-common": "0.1.17",
    "@rozoai/intent-pay": "0.1.22",
    "@radix-ui/react-icons": "^1.3.2",
    "@tanstack/react-query": "^5.0.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "geist": "^1.3.1",
    "lucide-react": "^0.511.0",
    "next": "16.2.6",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-syntax-highlighter": "^15.6.1",
    "tailwind-merge": "^3.3.0",
    "viem": "^2.0.0",
    "wagmi": "^2.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/react-syntax-highlighter": "^15.5.13",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/postcss": "^4.0.0",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create `examples/playground/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `examples/playground/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
};

export default nextConfig;
```

- [ ] **Step 4: Add playground to pnpm workspace**

In `pnpm-workspace.yaml`, add `examples/playground` under packages. The file currently lists `examples/nextjs-app` — add the new entry alongside it.

- [ ] **Step 5: Add dev script to root `package.json`**

Add to the `scripts` section:
```json
"dev:playground": "pnpm --filter playground dev"
```

- [ ] **Step 6: Install dependencies**

```bash
cd examples/playground
pnpm install
```

Expected: dependencies installed, `node_modules` created.

- [ ] **Step 7: Commit**

```bash
git add examples/playground/package.json examples/playground/tsconfig.json examples/playground/next.config.ts pnpm-workspace.yaml package.json pnpm-lock.yaml
git commit -m "chore: scaffold playground package"
```

---

## Task 2: Initialize shadcn/ui and global styles

**Files:**
- Create: `examples/playground/components.json`
- Create: `examples/playground/src/app/globals.css`
- Create: `examples/playground/postcss.config.mjs`

- [ ] **Step 1: Run shadcn init**

```bash
cd examples/playground
npx shadcn@latest init -d
```

This creates `components.json` and writes `src/app/globals.css`. Accept defaults.

- [ ] **Step 2: Fix Geist font in globals.css**

After init, open `src/app/globals.css`. Find the `@theme inline` block and replace any `var(--font-*)` circular references with literal names:

```css
@import "tailwindcss";

@theme inline {
  --font-sans: "Geist", "Geist Fallback", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "Geist Mono", "Geist Mono Fallback", ui-monospace, monospace;

  --color-background: oklch(0.145 0 0);
  --color-foreground: oklch(0.985 0 0);
  --color-card: oklch(0.205 0 0);
  --color-card-foreground: oklch(0.985 0 0);
  --color-popover: oklch(0.205 0 0);
  --color-popover-foreground: oklch(0.985 0 0);
  --color-primary: oklch(0.488 0.243 264.376);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-secondary: oklch(0.269 0 0);
  --color-secondary-foreground: oklch(0.985 0 0);
  --color-muted: oklch(0.269 0 0);
  --color-muted-foreground: oklch(0.708 0 0);
  --color-accent: oklch(0.269 0 0);
  --color-accent-foreground: oklch(0.985 0 0);
  --color-destructive: oklch(0.396 0.141 25.723);
  --color-border: oklch(0.269 0 0);
  --color-input: oklch(0.269 0 0);
  --color-ring: oklch(0.488 0.243 264.376);
  --radius: 0.625rem;
  --radius-xs: calc(var(--radius) * 0.5);
  --radius-sm: calc(var(--radius) * 0.75);
  --radius-md: calc(var(--radius) * 0.875);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.5);
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 3: Create `postcss.config.mjs`**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 4: Add shadcn components needed**

```bash
cd examples/playground
npx shadcn@latest add button card tabs badge separator label input select tooltip
```

- [ ] **Step 5: Commit**

```bash
git add examples/playground/
git commit -m "chore: init shadcn/ui with dark theme and Geist font for playground"
```

---

## Task 3: App layout and providers

**Files:**
- Create: `examples/playground/src/app/layout.tsx`
- Create: `examples/playground/src/app/providers.tsx`
- Create: `examples/playground/src/lib/utils.ts`

- [ ] **Step 1: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 2: Create `src/app/providers.tsx`**

```tsx
"use client";

import {
  getDefaultConfig as getDefaultConfigRozo,
  RozoPayProvider,
} from "@rozoai/intent-pay";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createConfig, WagmiProvider } from "wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  const [rozoPayConfig] = useState(() =>
    createConfig(
      getDefaultConfigRozo({
        appName: "Rozo Pay Playground",
        ssr: true,
      }),
    ),
  );

  return (
    <WagmiProvider config={rozoPayConfig}>
      <QueryClientProvider client={queryClient}>
        <RozoPayProvider debugMode mode="dark">
          {children}
        </RozoPayProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

- [ ] **Step 3: Create `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Rozo Pay Playground",
  description: "Interactive developer playground for @rozoai/intent-pay",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${GeistSans.variable} ${GeistMono.variable}`}
    >
      <body className="antialiased bg-background text-foreground min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Verify app boots**

```bash
cd examples/playground
pnpm dev
```

Open `http://localhost:3000` — should render a blank dark page with no errors.

- [ ] **Step 5: Commit**

```bash
git add examples/playground/src/
git commit -m "feat(playground): add layout, providers, and utility setup"
```

---

## Task 4: usePlaygroundConfig hook and chain helpers

**Files:**
- Create: `examples/playground/src/hooks/usePlaygroundConfig.ts`
- Create: `examples/playground/src/lib/chains.ts`

- [ ] **Step 1: Create `src/hooks/usePlaygroundConfig.ts`**

SSR-safe localStorage hook — reads on mount only to avoid hydration mismatch.

```ts
"use client";

import { useCallback, useEffect, useState } from "react";

export function usePlaygroundConfig<T>(
  key: string,
  defaults: T,
): [T, (value: T) => void] {
  const [config, setConfigState] = useState<T>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setConfigState(JSON.parse(raw) as T);
      }
    } catch {
      // corrupted storage — fall back to defaults
    }
  }, [key]);

  const setConfig = useCallback(
    (value: T) => {
      setConfigState(value);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage full or unavailable — ignore
      }
    },
    [key],
  );

  return [config, setConfig];
}
```

- [ ] **Step 2: Create `src/lib/chains.ts`**

Helpers to drive the chain/token selectors from `@rozoai/intent-common` data.

```ts
import {
  getChainById,
  supportedPayoutTokens,
  type Token,
} from "@rozoai/intent-common";

export interface ChainOption {
  chainId: number;
  name: string;
  type: "evm" | "solana" | "stellar";
}

export interface TokenOption {
  token: string;
  symbol: string;
  name: string;
}

export function getSupportedChains(): ChainOption[] {
  const chainIds = Array.from(supportedPayoutTokens.keys());
  return chainIds
    .map((id) => {
      const chain = getChainById(id);
      if (!chain) return null;
      return {
        chainId: id,
        name: chain.name,
        type: chain.type as "evm" | "solana" | "stellar",
      };
    })
    .filter((c): c is ChainOption => c !== null);
}

export function getTokensForChain(chainId: number): TokenOption[] {
  const tokens: Token[] = supportedPayoutTokens.get(chainId) ?? [];
  return tokens.map((t) => ({
    token: t.token,
    symbol: t.symbol,
    name: t.symbol,
  }));
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/playground/src/hooks/ examples/playground/src/lib/
git commit -m "feat(playground): add usePlaygroundConfig hook and chain helpers"
```

---

## Task 5: Code snippet generators

**Files:**
- Create: `examples/playground/src/lib/snippets.ts`

- [ ] **Step 1: Create `src/lib/snippets.ts`**

```ts
import { getChainById } from "@rozoai/intent-common";

export interface BridgeConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
}

export interface CheckoutConfig extends BridgeConfig {
  // same fields — checkout just pre-creates payment server-side
}

export interface DepositConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
  // no toUnits
}

const APP_ID = "rozoDemo";

function chainImport(chainId: number): string {
  const chain = getChainById(chainId);
  if (!chain) return "";
  const type = chain.type;
  if (type === "evm") return `import { getAddress } from "viem";`;
  return "";
}

function addressExpr(address: string, chainId: number): string {
  const chain = getChainById(chainId);
  if (!chain) return `"${address}"`;
  return chain.type === "evm"
    ? `getAddress("${address}")`
    : `"${address}"`;
}

function tokenExpr(token: string, chainId: number): string {
  const chain = getChainById(chainId);
  if (!chain) return `"${token}"`;
  return chain.type === "evm"
    ? `getAddress("${token}")`
    : `"${token}"`;
}

export function generateBridgeSnippet(config: BridgeConfig): string {
  const viemImport = chainImport(config.toChain);
  const addr = addressExpr(config.toAddress, config.toChain);
  const tok = tokenExpr(config.toToken, config.toChain);

  return `${viemImport ? viemImport + "\n" : ""}import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useState } from "react";

const APP_ID = "${APP_ID}";

export default function BridgePayment() {
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    resetPayment({
      toChain: ${config.toChain},
      toToken: ${tok},
      toAddress: ${addr},
      toUnits: "${config.toUnits}",
    }).then(() => setReady(true));
  }, [resetPayment]);

  return (
    <RozoPayButton.Custom
      appId={APP_ID}
      toChain={${config.toChain}}
      toToken={${tok}}
      toAddress={${addr}}
      toUnits="${config.toUnits}"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => (
        <button onClick={show} disabled={!ready}>
          Pay Now
        </button>
      )}
    </RozoPayButton.Custom>
  );
}`;
}

export function generateCheckoutSnippet(config: CheckoutConfig): string {
  const viemImport = chainImport(config.toChain);
  const addr = addressExpr(config.toAddress, config.toChain);
  const tok = tokenExpr(config.toToken, config.toChain);

  return `${viemImport ? viemImport + "\n" : ""}import { RozoPayButton } from "@rozoai/intent-pay";
import { createPayment } from "@rozoai/intent-common";
import { useState } from "react";

const APP_ID = "${APP_ID}";

export default function OnlineCheckout() {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreatePayment() {
    setLoading(true);
    try {
      const result = await createPayment({
        appId: APP_ID,
        toChain: ${config.toChain},
        toToken: ${tok},
        toAddress: ${addr},
        toUnits: "${config.toUnits}",
        preferredChain: ${config.toChain},
        preferredTokenAddress: ${tok},
      });
      setPaymentId(result.paymentId);
    } finally {
      setLoading(false);
    }
  }

  if (!paymentId) {
    return (
      <button onClick={handleCreatePayment} disabled={loading}>
        {loading ? "Creating..." : "Create Payment"}
      </button>
    );
  }

  return (
    <RozoPayButton.Custom
      key={paymentId}
      appId={APP_ID}
      payId={paymentId}
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => <button onClick={show}>Pay Now</button>}
    </RozoPayButton.Custom>
  );
}`;
}

export function generateDepositSnippet(config: DepositConfig): string {
  const viemImport = chainImport(config.toChain);
  const addr = addressExpr(config.toAddress, config.toChain);
  const tok = tokenExpr(config.toToken, config.toChain);

  return `${viemImport ? viemImport + "\n" : ""}import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useState } from "react";

const APP_ID = "${APP_ID}";

export default function WalletDeposit() {
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    resetPayment({
      toChain: ${config.toChain},
      toToken: ${tok},
      toAddress: ${addr},
      // No toUnits — user enters amount inside the modal
    }).then(() => setReady(true));
  }, [resetPayment]);

  return (
    <RozoPayButton.Custom
      appId={APP_ID}
      toChain={${config.toChain}}
      toToken={${tok}}
      toAddress={${addr}}
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => (
        <button onClick={show} disabled={!ready}>
          Deposit
        </button>
      )}
    </RozoPayButton.Custom>
  );
}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/playground/src/lib/snippets.ts
git commit -m "feat(playground): add code snippet generators for all 3 scenarios"
```

---

## Task 6: ParamForm component

**Files:**
- Create: `examples/playground/src/components/ParamForm.tsx`

- [ ] **Step 1: Create `src/components/ParamForm.tsx`**

Shared form: chain selector, token selector (updates when chain changes), address input, amount input (hidden when `showAmount=false`).

```tsx
"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupportedChains, getTokensForChain } from "@/lib/chains";
import { useEffect, useMemo, useState } from "react";

export interface ParamFormValues {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
}

interface ParamFormProps {
  values: ParamFormValues;
  onChange: (values: ParamFormValues) => void;
  showAmount?: boolean;
}

const chains = getSupportedChains();

export function ParamForm({
  values,
  onChange,
  showAmount = true,
}: ParamFormProps) {
  const tokens = useMemo(
    () => getTokensForChain(values.toChain),
    [values.toChain],
  );

  // Reset token when chain changes and current token not in new chain
  useEffect(() => {
    const tokenExists = tokens.some((t) => t.token === values.toToken);
    if (!tokenExists && tokens.length > 0) {
      onChange({ ...values, toToken: tokens[0].token });
    }
  }, [tokens]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Destination Chain</Label>
        <Select
          value={String(values.toChain)}
          onValueChange={(v) =>
            onChange({ ...values, toChain: Number(v), toToken: "" })
          }
        >
          <SelectTrigger className="w-full bg-secondary border-border">
            <SelectValue placeholder="Select chain" />
          </SelectTrigger>
          <SelectContent>
            {chains.map((c) => (
              <SelectItem key={c.chainId} value={String(c.chainId)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Destination Token</Label>
        <Select
          value={values.toToken}
          onValueChange={(v) => onChange({ ...values, toToken: v })}
          disabled={tokens.length === 0}
        >
          <SelectTrigger className="w-full bg-secondary border-border">
            <SelectValue placeholder="Select token" />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem key={t.token} value={t.token}>
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Recipient Address</Label>
        <Input
          value={values.toAddress}
          onChange={(e) => onChange({ ...values, toAddress: e.target.value })}
          placeholder="0x... or Solana/Stellar address"
          className="bg-secondary border-border font-mono text-xs"
        />
      </div>

      {showAmount && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Amount (human units, e.g. "1" = 1 USDC)
          </Label>
          <Input
            value={values.toUnits}
            onChange={(e) => onChange({ ...values, toUnits: e.target.value })}
            placeholder="1.00"
            className="bg-secondary border-border"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/playground/src/components/ParamForm.tsx
git commit -m "feat(playground): add ParamForm with chain/token/address/amount fields"
```

---

## Task 7: EventLog component

**Files:**
- Create: `examples/playground/src/components/EventLog.tsx`

- [ ] **Step 1: Create `src/components/EventLog.tsx`**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  type: "started" | "completed" | "payout";
  payload: unknown;
  timestamp: number;
}

interface EventLogProps {
  entries: LogEntry[];
}

const labelMap: Record<LogEntry["type"], string> = {
  started: "onPaymentStarted",
  completed: "onPaymentCompleted",
  payout: "onPayoutCompleted",
};

const colorMap: Record<LogEntry["type"], string> = {
  started: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  completed: "bg-green-500/20 text-green-300 border-green-500/30",
  payout: "bg-violet-500/20 text-violet-300 border-violet-500/30",
};

export function EventLog({ entries }: EventLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Events will appear here as you complete payment steps.
      </p>
    );
  }

  return (
    <ScrollArea className="h-40 w-full rounded-md border border-border bg-secondary/50">
      <div className="p-3 space-y-2">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start gap-2">
            <Badge
              variant="outline"
              className={`shrink-0 text-xs px-1.5 py-0.5 ${colorMap[entry.type]}`}
            >
              {labelMap[entry.type]}
            </Badge>
            <pre className="text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 2: Add ScrollArea shadcn component**

```bash
cd examples/playground
npx shadcn@latest add scroll-area
```

- [ ] **Step 3: Commit**

```bash
git add examples/playground/src/components/EventLog.tsx
git commit -m "feat(playground): add EventLog component for callback events"
```

---

## Task 8: CodeSnippet component

**Files:**
- Create: `examples/playground/src/components/CodeSnippet.tsx`

- [ ] **Step 1: Create `src/components/CodeSnippet.tsx`**

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface CodeSnippetProps {
  code: string;
}

export function CodeSnippet({ code }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-border">
      <Button
        size="icon"
        variant="ghost"
        onClick={handleCopy}
        className="absolute top-2 right-2 z-10 h-7 w-7 bg-secondary hover:bg-accent"
        title="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
      <SyntaxHighlighter
        language="tsx"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: "1.25rem",
          fontSize: "0.8rem",
          lineHeight: "1.6",
          background: "transparent",
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/playground/src/components/CodeSnippet.tsx
git commit -m "feat(playground): add CodeSnippet with syntax highlighting and copy"
```

---

## Task 9: BridgeMode component

**Files:**
- Create: `examples/playground/src/components/BridgeMode.tsx`

- [ ] **Step 1: Create `src/components/BridgeMode.tsx`**

```tsx
"use client";

import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ParamForm, type ParamFormValues } from "./ParamForm";
import { PreviewPane } from "./PreviewPane";
import { EventLog, type LogEntry } from "./EventLog";
import { CodeSnippet } from "./CodeSnippet";
import { usePlaygroundConfig } from "@/hooks/usePlaygroundConfig";
import { generateBridgeSnippet } from "@/lib/snippets";

const APP_ID = "rozoDemo";

const DEFAULTS: ParamFormValues = {
  toChain: 8453,
  toToken: "",
  toAddress: "",
  toUnits: "",
};

export function BridgeMode() {
  const [config, setConfig] = usePlaygroundConfig<ParamFormValues>(
    "playground-bridge",
    DEFAULTS,
  );
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logId = useId();

  const isConfigValid =
    config.toChain > 0 &&
    config.toToken !== "" &&
    config.toAddress !== "" &&
    config.toUnits !== "";

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        {
          id: `${logId}-${Date.now()}`,
          type,
          payload,
          timestamp: Date.now(),
        },
      ]);
    },
    [logId],
  );

  const applyConfig = useCallback(
    async (c: ParamFormValues) => {
      if (!c.toChain || !c.toToken || !c.toAddress || !c.toUnits) return;
      setResetting(true);
      setReady(false);
      try {
        await resetPayment({
          toChain: c.toChain,
          toToken: c.toToken,
          toAddress: c.toAddress,
          toUnits: c.toUnits,
        });
        setReady(true);
      } finally {
        setResetting(false);
      }
    },
    [resetPayment],
  );

  const handleChange = useCallback(
    (values: ParamFormValues) => {
      setConfig(values);
      applyConfig(values);
    },
    [setConfig, applyConfig],
  );

  // Apply on mount if config already saved
  useEffect(() => {
    applyConfig(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snippet = isConfigValid ? generateBridgeSnippet(config) : "";

  const preview = (
    <div className="flex flex-col items-center gap-6 py-8">
      {isConfigValid ? (
        <RozoPayButton.Custom
          appId={APP_ID}
          toChain={config.toChain}
          toToken={config.toToken}
          toAddress={config.toAddress}
          toUnits={config.toUnits}
          resetOnSuccess
          showProcessingPayout
          onPaymentStarted={(e) => addLog("started", e)}
          onPaymentCompleted={(e) => addLog("completed", e)}
          onPayoutCompleted={(e) => addLog("payout", e)}
        >
          {({ show }) => (
            <Button
              onClick={show}
              disabled={!ready || resetting}
              size="lg"
              className="min-w-40"
            >
              {resetting ? "Preparing..." : "Pay Now"}
            </Button>
          )}
        </RozoPayButton.Custom>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to enable the payment button.
        </p>
      )}
      <div className="w-full">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Events
        </p>
        <EventLog entries={logs} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 h-full">
      <aside className="space-y-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Configuration
          </p>
          <ParamForm values={config} onChange={handleChange} showAmount />
        </div>
      </aside>
      <main>
        <PreviewPane
          preview={preview}
          code={snippet ? <CodeSnippet code={snippet} /> : null}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/playground/src/components/BridgeMode.tsx
git commit -m "feat(playground): add BridgeMode with resetPayment flow"
```

---

## Task 10: CheckoutMode component

**Files:**
- Create: `examples/playground/src/components/CheckoutMode.tsx`

- [ ] **Step 1: Create `src/components/CheckoutMode.tsx`**

Key insight: `key={paymentId}` on `RozoPayButton.Custom` forces full remount when `paymentId` changes, avoiding stale SDK state. Config change clears `paymentId`, forcing re-click of "Create Payment."

```tsx
"use client";

import { createPayment } from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";
import { useCallback, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ParamForm, type ParamFormValues } from "./ParamForm";
import { PreviewPane } from "./PreviewPane";
import { EventLog, type LogEntry } from "./EventLog";
import { CodeSnippet } from "./CodeSnippet";
import { usePlaygroundConfig } from "@/hooks/usePlaygroundConfig";
import { generateCheckoutSnippet } from "@/lib/snippets";

const APP_ID = "rozoDemo";

const DEFAULTS: ParamFormValues = {
  toChain: 8453,
  toToken: "",
  toAddress: "",
  toUnits: "",
};

export function CheckoutMode() {
  const [config, setConfig] = usePlaygroundConfig<ParamFormValues>(
    "playground-checkout",
    DEFAULTS,
  );
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logId = useId();

  const isConfigValid =
    config.toChain > 0 &&
    config.toToken !== "" &&
    config.toAddress !== "" &&
    config.toUnits !== "";

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        {
          id: `${logId}-${Date.now()}`,
          type,
          payload,
          timestamp: Date.now(),
        },
      ]);
    },
    [logId],
  );

  const handleConfigChange = useCallback(
    (values: ParamFormValues) => {
      setConfig(values);
      // Clear paymentId when config changes — forces re-click "Create Payment"
      setPaymentId(null);
      setError(null);
    },
    [setConfig],
  );

  const handleCreatePayment = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const result = await createPayment({
        appId: APP_ID,
        toChain: config.toChain,
        toToken: config.toToken,
        toAddress: config.toAddress,
        toUnits: config.toUnits,
        preferredChain: config.toChain,
        preferredTokenAddress: config.toToken,
      });
      setPaymentId(result.paymentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payment");
    } finally {
      setCreating(false);
    }
  }, [config]);

  const snippet = isConfigValid ? generateCheckoutSnippet(config) : "";

  const preview = (
    <div className="flex flex-col items-center gap-6 py-8">
      {isConfigValid ? (
        <>
          {!paymentId ? (
            <div className="flex flex-col items-center gap-3">
              <Button
                onClick={handleCreatePayment}
                disabled={creating}
                size="lg"
                className="min-w-40"
              >
                {creating ? "Creating Payment..." : "Create Payment"}
              </Button>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          ) : (
            <RozoPayButton.Custom
              key={paymentId}
              appId={APP_ID}
              payId={paymentId}
              onPaymentStarted={(e) => addLog("started", e)}
              onPaymentCompleted={(e) => addLog("completed", e)}
              onPayoutCompleted={(e) => addLog("payout", e)}
            >
              {({ show }) => (
                <Button onClick={show} size="lg" className="min-w-40">
                  Pay Now
                </Button>
              )}
            </RozoPayButton.Custom>
          )}
          {paymentId && (
            <p className="text-xs text-muted-foreground font-mono">
              paymentId: {paymentId}
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to create a payment.
        </p>
      )}
      <div className="w-full">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Events
        </p>
        <EventLog entries={logs} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 h-full">
      <aside className="space-y-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Configuration
          </p>
          <ParamForm values={config} onChange={handleConfigChange} showAmount />
        </div>
      </aside>
      <main>
        <PreviewPane
          preview={preview}
          code={snippet ? <CodeSnippet code={snippet} /> : null}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/playground/src/components/CheckoutMode.tsx
git commit -m "feat(playground): add CheckoutMode with createPayment and keyed remount"
```

---

## Task 11: DepositMode component

**Files:**
- Create: `examples/playground/src/components/DepositMode.tsx`

- [ ] **Step 1: Create `src/components/DepositMode.tsx`**

Identical to BridgeMode except `showAmount={false}` and `toUnits` is omitted from `resetPayment`.

```tsx
"use client";

import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { ParamForm } from "./ParamForm";
import { PreviewPane } from "./PreviewPane";
import { EventLog, type LogEntry } from "./EventLog";
import { CodeSnippet } from "./CodeSnippet";
import { usePlaygroundConfig } from "@/hooks/usePlaygroundConfig";
import { generateDepositSnippet } from "@/lib/snippets";

const APP_ID = "rozoDemo";

interface DepositFormValues {
  toChain: number;
  toToken: string;
  toAddress: string;
}

const DEFAULTS: DepositFormValues = {
  toChain: 8453,
  toToken: "",
  toAddress: "",
};

export function DepositMode() {
  const [config, setConfig] = usePlaygroundConfig<DepositFormValues>(
    "playground-deposit",
    DEFAULTS,
  );
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logId = useId();

  const isConfigValid =
    config.toChain > 0 && config.toToken !== "" && config.toAddress !== "";

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        {
          id: `${logId}-${Date.now()}`,
          type,
          payload,
          timestamp: Date.now(),
        },
      ]);
    },
    [logId],
  );

  const applyConfig = useCallback(
    async (c: DepositFormValues) => {
      if (!c.toChain || !c.toToken || !c.toAddress) return;
      setResetting(true);
      setReady(false);
      try {
        await resetPayment({
          toChain: c.toChain,
          toToken: c.toToken,
          toAddress: c.toAddress,
          // toUnits intentionally omitted — user sets amount in modal
        });
        setReady(true);
      } finally {
        setResetting(false);
      }
    },
    [resetPayment],
  );

  const handleChange = useCallback(
    (values: { toChain: number; toToken: string; toAddress: string; toUnits: string }) => {
      const v: DepositFormValues = {
        toChain: values.toChain,
        toToken: values.toToken,
        toAddress: values.toAddress,
      };
      setConfig(v);
      applyConfig(v);
    },
    [setConfig, applyConfig],
  );

  useEffect(() => {
    applyConfig(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snippet = isConfigValid ? generateDepositSnippet(config) : "";

  const formValues = { ...config, toUnits: "" };

  const preview = (
    <div className="flex flex-col items-center gap-6 py-8">
      {isConfigValid ? (
        <RozoPayButton.Custom
          appId={APP_ID}
          toChain={config.toChain}
          toToken={config.toToken}
          toAddress={config.toAddress}
          resetOnSuccess
          showProcessingPayout
          onPaymentStarted={(e) => addLog("started", e)}
          onPaymentCompleted={(e) => addLog("completed", e)}
          onPayoutCompleted={(e) => addLog("payout", e)}
        >
          {({ show }) => (
            <Button
              onClick={show}
              disabled={!ready || resetting}
              size="lg"
              className="min-w-40"
            >
              {resetting ? "Preparing..." : "Deposit"}
            </Button>
          )}
        </RozoPayButton.Custom>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to enable the deposit button.
        </p>
      )}
      <div className="w-full">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Events
        </p>
        <EventLog entries={logs} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[320px_1fr] gap-6 h-full">
      <aside className="space-y-6">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Configuration
          </p>
          <ParamForm
            values={formValues}
            onChange={handleChange}
            showAmount={false}
          />
        </div>
      </aside>
      <main>
        <PreviewPane
          preview={preview}
          code={snippet ? <CodeSnippet code={snippet} /> : null}
        />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add examples/playground/src/components/DepositMode.tsx
git commit -m "feat(playground): add DepositMode without toUnits"
```

---

## Task 12: PreviewPane and ScenarioTabs

**Files:**
- Create: `examples/playground/src/components/PreviewPane.tsx`
- Create: `examples/playground/src/components/ScenarioTabs.tsx`

- [ ] **Step 1: Create `src/components/PreviewPane.tsx`**

Preview/Code tab switcher.

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReactNode } from "react";

interface PreviewPaneProps {
  preview: ReactNode;
  code: ReactNode;
}

export function PreviewPane({ preview, code }: PreviewPaneProps) {
  return (
    <Tabs defaultValue="preview" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="code">Code</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <div className="rounded-xl border border-border bg-card p-6 min-h-64">
          {preview}
        </div>
      </TabsContent>
      <TabsContent value="code">
        <div className="rounded-xl border border-border overflow-hidden">
          {code ?? (
            <p className="text-sm text-muted-foreground p-6">
              Fill in the configuration to generate code.
            </p>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: Create `src/components/ScenarioTabs.tsx`**

```tsx
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BridgeMode } from "./BridgeMode";
import { CheckoutMode } from "./CheckoutMode";
import { DepositMode } from "./DepositMode";

export function ScenarioTabs() {
  return (
    <Tabs defaultValue="bridge" className="w-full h-full">
      <TabsList className="mb-6">
        <TabsTrigger value="bridge">Bridge</TabsTrigger>
        <TabsTrigger value="checkout">Online Checkout</TabsTrigger>
        <TabsTrigger value="deposit">Wallet Deposit</TabsTrigger>
      </TabsList>
      <TabsContent value="bridge">
        <BridgeMode />
      </TabsContent>
      <TabsContent value="checkout">
        <CheckoutMode />
      </TabsContent>
      <TabsContent value="deposit">
        <DepositMode />
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add examples/playground/src/components/PreviewPane.tsx examples/playground/src/components/ScenarioTabs.tsx
git commit -m "feat(playground): add PreviewPane tabs and ScenarioTabs"
```

---

## Task 13: Main page and final wiring

**Files:**
- Create: `examples/playground/src/app/page.tsx`

- [ ] **Step 1: Create `src/app/page.tsx`**

```tsx
import { ScenarioTabs } from "@/components/ScenarioTabs";
import { Separator } from "@/components/ui/separator";

export default function PlaygroundPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <div>
            <h1 className="text-sm font-semibold text-foreground">
              Rozo Pay Playground
            </h1>
            <p className="text-xs text-muted-foreground">
              @rozoai/intent-pay — interactive developer playground
            </p>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-6">
        <ScenarioTabs />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Start the playground and verify**

```bash
cd examples/playground
pnpm dev
```

Open `http://localhost:3000`:
- Dark background, Geist font ✓
- Three scenario tabs: Bridge, Online Checkout, Wallet Deposit ✓
- Each tab shows: sidebar param form + Preview/Code tabs ✓
- Selecting a chain populates token dropdown ✓
- Filling all fields shows the live RozoPayButton ✓
- Code tab shows syntax-highlighted snippet ✓

- [ ] **Step 3: Final commit**

```bash
git add examples/playground/src/app/page.tsx
git commit -m "feat(playground): wire main page — playground complete"
```

---

## Self-Review Notes

- **Spec coverage:** All 3 modes implemented with correct flows. localStorage per scenario. `resetPayment` disabled during flight. `createPayment` + keyed remount for Checkout. `toUnits` omitted for Deposit. All 3 callbacks in all modes. ✓
- **Placeholder scan:** No TBDs. All code blocks complete. ✓
- **Type consistency:** `ParamFormValues` used consistently across Bridge/Checkout; Deposit uses its own `DepositFormValues` type and adapts to `ParamForm` via mapping. `LogEntry` type defined once in `EventLog.tsx`, imported in all mode components. `generateBridgeSnippet`, `generateCheckoutSnippet`, `generateDepositSnippet` all defined in `snippets.ts`. ✓
- **Known gap:** `createPayment` returns `result.paymentId` — verify the actual field name from `PaymentResponse` type before implementing. The type is at `packages/pay-common/src/api/types.ts`. If the field is different, update Task 10 accordingly.
