# Stellar: External Kit & Connect (SWK 2.x)

How to integrate Stellar Wallets Kit 2.x with the SDK, pass an external kit, and connect Stellar wallets.

> **Migrating from v1?** See the [Migration from v1](#migration-from-v1) section at the bottom.

---

## What changed in v2

SWK 2.x changed from an **OOP instance model** to a **static singleton**:

| | v1 (`@creit.tech/stellar-wallets-kit ^1.x`) | v2 (`@creit-tech/stellar-wallets-kit ^2.x`) |
|---|---|---|
| Package name | `@creit.tech/stellar-wallets-kit` (npm) | `@creit-tech/stellar-wallets-kit` (JSR) |
| Init | `new StellarWalletsKit({ network, modules })` | `StellarWalletsKit.init({ modules })` |
| Methods | Instance: `kit.setWallet()`, `kit.getAddress()` | Static: `StellarWalletsKit.setWallet()`, `.fetchAddress()` |
| Wallet list | `kit.getSupportedWallets()` | `StellarWalletsKit.refreshSupportedWallets()` |
| Default modules | `allowAllModules()` | `defaultModules()` from `/modules/utils` |
| WalletConnect config | `{ name, url, description, icons, network }` | `{ projectId, metadata: { name, description, url, icons } }` |
| External kit prop | `stellarKit={myKitInstance}` | `stellarKit={true}` (boolean flag) |

The static singleton means connection state is shared globally — if a user connects their Stellar wallet anywhere in the app, the SDK picks it up automatically via `STATE_UPDATED` events.

---

## Installation

SWK v2 is published on **JSR** (not npm). JSR packages require a one-time registry setup or a special install command depending on your package manager.

```bash
# pnpm
pnpm add jsr:@creit-tech/stellar-wallets-kit

# npm
npx jsr add @creit-tech/stellar-wallets-kit

# yarn (v1 / classic)
yarn add jsr:@creit-tech/stellar-wallets-kit

# bun
bunx jsr add @creit-tech/stellar-wallets-kit

# Deno
deno add jsr:@creit-tech/stellar-wallets-kit
```

> **Why JSR?** The SWK team moved from `@creit.tech` (npm) to `@creit-tech` (JSR) in v2. JSR is a modern TypeScript-first registry compatible with all runtimes. The `jsr:` prefix tells your package manager to fetch from `jsr.io` instead of `registry.npmjs.org`.

### Verify install

After installing, check `node_modules/@creit-tech/stellar-wallets-kit/package.json` — the `version` field should be `2.x.x`.

### TypeScript / bundler requirement

JSR packages use the `exports` field in `package.json` for subpath resolution (e.g. `@creit-tech/stellar-wallets-kit/modules/wallet-connect`). Your `tsconfig.json` **must** use `moduleResolution: "bundler"`, `"node16"`, or `"nodenext"` — **not** `"node"`.

```json
// tsconfig.json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

Bundlers (Vite, Webpack 5, Rollup, esbuild, Turbopack) resolve `exports` automatically — no extra config needed there.

---

## 1. Default setup (no external kit)

If you don't need custom modules, **don't pass `stellarKit` at all**. The SDK initializes internally with default modules + WalletConnect.

```tsx
import { RozoPayProvider } from "@rozoai/intent-pay";

export function App() {
  return (
    <RozoPayProvider config={wagmiConfig}>
      {children}
    </RozoPayProvider>
  );
}
```

---

## 2. External kit setup (consumer controls init)

Use this when:
- You need **custom modules** (e.g. only Freighter + WalletConnect, no others)
- You use Stellar **elsewhere in your app** before mounting `RozoPayProvider`
- You want to connect the user's Stellar wallet **before** they open the payment modal

**Step 1:** Call `StellarWalletsKit.init()` once at app root (outside any component).

**Step 2:** Pass `stellarKit={true}` to `RozoPayProvider` to tell the SDK "kit is already initialized."

```tsx
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { WalletConnectModule } from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
import { RozoPayProvider } from "@rozoai/intent-pay";

// Call once at app entry — outside any component, never inside useEffect
StellarWalletsKit.init({
  modules: [
    ...defaultModules(),
    new WalletConnectModule({
      projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
      metadata: {
        name: "Your App",
        description: "Your app description",
        url: typeof window !== "undefined" ? window.location.origin : "https://example.com",
        icons: ["https://example.com/icon.png"],
      },
    }),
  ],
});

export function App() {
  return (
    <RozoPayProvider config={wagmiConfig} stellarKit={true}>
      {children}
    </RozoPayProvider>
  );
}
```

### How auto-detection works

When `stellarKit={true}`, the SDK skips its internal `init()` and instead subscribes to `KitEventType.STATE_UPDATED` and `KitEventType.DISCONNECT` events. Any wallet connection made anywhere in the app is automatically reflected in the payment modal.

---

## 3. WalletConnect configuration

```tsx
import { WalletConnectModule } from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";

new WalletConnectModule({
  projectId: "YOUR_PROJECT_ID",  // from cloud.walletconnect.com
  metadata: {
    name: "Your App Name",
    description: "Description shown in the wallet",
    url: "https://yourapp.com",
    icons: ["https://yourapp.com/icon.png"],
  },
  // Optional:
  // allowedChains: ["stellar:pubnet"],
  // signClientOptions: { ... },
  // appKitOptions: { ... },
})
```

---

## 4. Connecting Stellar wallets in your own UI

Use `useRozoConnectStellar()` to add a Stellar connect button outside the payment modal.

```tsx
import { useRozoConnectStellar } from "@rozoai/intent-pay";
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit";
import { useState, useEffect } from "react";

function ConnectStellarButton() {
  const { isConnected, publicKey, setConnector, disconnect } = useRozoConnectStellar();
  const [wallets, setWallets] = useState([]);

  useEffect(() => {
    StellarWalletsKit.refreshSupportedWallets().then((list) => {
      setWallets(list.filter((w) => w.isAvailable));
    });
  }, []);

  if (isConnected && publicKey) {
    return (
      <div>
        <p>Connected: {publicKey.slice(0, 8)}…</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      {wallets.map((wallet) => (
        <button key={wallet.id} onClick={() => setConnector(wallet)}>
          {wallet.name}
        </button>
      ))}
    </div>
  );
}
```

### Why use `setConnector()` instead of calling `StellarWalletsKit.setWallet()` directly?

`setConnector(wallet)` is **idempotent** — if the same wallet is already connected, it skips the kit call to avoid double WalletConnect confirmations. It also syncs state with the payment modal.

```tsx
// ❌ Don't: bypasses SDK idempotency guard, can cause double prompts
StellarWalletsKit.setWallet(wallet.id);
const { address } = await StellarWalletsKit.fetchAddress();

// ✅ Do: SDK handles setWallet + fetchAddress + state sync
await setConnector(wallet);
```

---

## 5. `useRozoConnectStellar()` API

| Returned | Type | Description |
|---|---|---|
| `isConnected` | `boolean` | Whether a Stellar wallet is connected |
| `publicKey` | `string \| undefined` | Connected Stellar address |
| `account` | `AccountResponse \| undefined` | Horizon account for `publicKey` |
| `connector` | `ISupportedWallet \| undefined` | Currently connected wallet object |
| `setConnector` | `(wallet: ISupportedWallet) => Promise<void>` | Connect wallet (idempotent) |
| `disconnect` | `() => Promise<void>` | Disconnect and clear persisted session |

---

## 6. `RozoPayProvider` Stellar props

| Prop | Type | Description |
|---|---|---|
| `stellarKit` | `boolean` (optional) | Pass `true` if you called `StellarWalletsKit.init()` yourself. Omit for SDK auto-init. |
| `stellarWalletPersistence` | `boolean` | Persist last wallet in `localStorage`. Default `true`. |
| `stellarRpcUrl` | `string` | Custom Horizon RPC URL. Default: Stellar mainnet. |

---

## Migration from v1

### 1. Replace the package

```bash
# Remove old (npm)
pnpm remove @creit.tech/stellar-wallets-kit

# Add new (JSR)
pnpm add jsr:@creit-tech/stellar-wallets-kit
```

### 2. Update import paths

```typescript
// v1
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from "@creit.tech/stellar-wallets-kit";

// v2
import { StellarWalletsKit } from "@creit-tech/stellar-wallets-kit";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import { WalletConnectModule } from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";
// Note: WalletNetwork and FREIGHTER_ID removed — network is now configured internally
```

### 3. Replace initialization

```typescript
// v1 — constructor, returns instance
const stellarKit = new StellarWalletsKit({
  network: WalletNetwork.PUBLIC,
  selectedWalletId: FREIGHTER_ID,
  modules: allowAllModules(),
});

// v2 — static init, no instance returned
StellarWalletsKit.init({
  modules: defaultModules(),
});
```

### 4. Update WalletConnect module params

```typescript
// v1
new WalletConnectModule({
  name: "My App",
  url: "https://myapp.com",
  description: "My app",
  icons: ["https://myapp.com/icon.png"],
  projectId: "YOUR_PROJECT_ID",
  network: WalletNetwork.PUBLIC,
  method: WalletConnectAllowedMethods.SIGN,
});

// v2 — metadata object, no network/method params
new WalletConnectModule({
  projectId: "YOUR_PROJECT_ID",
  metadata: {
    name: "My App",
    description: "My app",
    url: "https://myapp.com",
    icons: ["https://myapp.com/icon.png"],
  },
});
```

### 5. Update RozoPayProvider prop

```tsx
// v1
<RozoPayProvider config={wagmiConfig} stellarKit={stellarKit}>

// v2 — pass true if you called init() yourself; omit for auto-init
<RozoPayProvider config={wagmiConfig} stellarKit={true}>
```

### 6. Update method calls (if calling kit directly)

```typescript
// v1 — instance methods
kit.setWallet(walletId);
const { address } = await kit.getAddress();
const wallets = await kit.getSupportedWallets();
const { signedTxXdr } = await kit.signTransaction(xdr, opts);

// v2 — static methods
StellarWalletsKit.setWallet(walletId);
const { address } = await StellarWalletsKit.fetchAddress();  // fresh from module
// or: StellarWalletsKit.getAddress()  — returns cached address
const wallets = await StellarWalletsKit.refreshSupportedWallets();
const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, opts);
```

### 7. Optionally: use the new event system

```typescript
import { KitEventType } from "@creit-tech/stellar-wallets-kit";

// Subscribe to connection changes
const unsubState = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
  console.log("Connected address:", event.payload.address);
});

const unsubDisconnect = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
  console.log("Wallet disconnected");
});

// Clean up when done
unsubState();
unsubDisconnect();
```

---

For payment flow details, see [ARCHITECTURE.md](./ARCHITECTURE.md). For troubleshooting, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
