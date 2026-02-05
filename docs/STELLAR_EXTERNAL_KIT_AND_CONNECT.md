# Stellar: External Kit & Connect

How to pass your own Stellar Wallets Kit to the SDK and connect Stellar wallets without double confirmation prompts.

---

## When to use an external Stellar kit

- You want to configure **WalletConnect**, custom modules, or network yourself.
- You use Stellar elsewhere in your app and need **one shared kit instance** (avoids "custom element already registered" errors).
- You want a **custom default wallet** (e.g. `selectedWalletId: FREIGHTER_ID`).

If you don’t pass a kit, the SDK creates an internal singleton. For most custom setups, pass a kit via the `stellarKit` prop.

---

## 1. Create one kit and pass it to RozoPayProvider

Create **one** `StellarWalletsKit` instance at app root and pass it to `RozoPayProvider`. Do not create the kit inside a component that re-renders, or you’ll get duplicate registration errors.

### Minimal

```tsx
import { StellarWalletsKit, WalletNetwork, allowAllModules } from "@creit.tech/stellar-wallets-kit";
import { RozoPayProvider } from "@rozoai/intent-pay";

const stellarKit = new StellarWalletsKit({
  network: WalletNetwork.PUBLIC,
  modules: allowAllModules(),
});

export function App() {
  return (
    <RozoPayProvider config={wagmiConfig} stellarKit={stellarKit}>
      {children}
    </RozoPayProvider>
  );
}
```

### With WalletConnect

```tsx
import {
  WalletConnectAllowedMethods,
  WalletConnectModule,
} from "@creit.tech/stellar-wallets-kit/modules/walletconnect.module";
import {
  allowAllModules,
  FREIGHTER_ID,
  StellarWalletsKit,
  WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";
import { RozoPayProvider } from "@rozoai/intent-pay";

const stellarKit = new StellarWalletsKit({
  network: WalletNetwork.PUBLIC,
  selectedWalletId: FREIGHTER_ID,
  modules: [
    ...allowAllModules(),
    new WalletConnectModule({
      url: typeof window !== "undefined" ? window.location.origin : "https://example.com",
      projectId: "YOUR_WALLETCONNECT_PROJECT_ID",
      method: WalletConnectAllowedMethods.SIGN,
      description: "Your app description",
      name: "Your App",
      icons: ["https://example.com/icon.png"],
      network: WalletNetwork.PUBLIC,
    }),
  ],
});

export function App() {
  return (
    <RozoPayProvider config={wagmiConfig} stellarKit={stellarKit}>
      {children}
    </RozoPayProvider>
  );
}
```

### Provider props

| Prop                       | Type                 | Description                                                                 |
|----------------------------|----------------------|-----------------------------------------------------------------------------|
| `stellarKit`               | `StellarWalletsKit`  | Your kit instance. Optional; if omitted, SDK uses an internal singleton.   |
| `stellarWalletPersistence` | `boolean`            | Persist last-connected Stellar wallet in `localStorage`. Default `true`.    |

---

## 2. Connecting Stellar wallets (correct pattern)

Use the SDK’s connection API so connection is **idempotent** and you get a **single** WalletConnect (or wallet) confirmation.

### Use `useRozoConnectStellar()` and `setConnector(wallet)`

For a **custom “Connect Stellar” button** (or any UI outside the payment modal), use the hook and call **only** `setConnector(wallet)` to connect. Do **not** call `kit.setWallet()` or `kit.getAddress()` yourself.

```tsx
import { useRozoConnectStellar } from "@rozoai/intent-pay";

function ConnectStellarButton() {
  const { kit, isConnected, publicKey, connector, setConnector, disconnect } = useRozoConnectStellar();
  const [wallets, setWallets] = useState([]);
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    if (!kit) return;
    kit.getSupportedWallets().then((list) => {
      setWallets(list.filter((w) => w.isAvailable));
    });
  }, [kit]);

  const handleConnect = async (wallet) => {
    if (!kit) return;
    await setConnector(wallet);  // ✅ One call – SDK does kit.setWallet + getAddress + state
    setShowList(false);
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  if (isConnected && publicKey) {
    return (
      <div>
        <p>Connected: {publicKey.slice(0, 8)}…</p>
        <button onClick={handleDisconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => setShowList(true)}>Connect Stellar</button>
      {showList && wallets.map((w) => (
        <button key={w.id} onClick={() => handleConnect(w)}>{w.name}</button>
      ))}
    </div>
  );
}
```

### Why use `setConnector(wallet)` instead of the kit directly?

- **Single confirmation** – The SDK’s `setWallet` runs `kit.setWallet(option.id)` and `kit.getAddress()` once and updates context. Calling `kit.setWallet()` and `kit.getAddress()` yourself (or twice due to Strict Mode) can trigger **multiple** WalletConnect/wallet prompts.
- **Idempotent** – If the same wallet is already connected, the SDK skips calling the kit again, so remounts or duplicate calls don’t cause extra prompts.
- **Shared state** – Connection state is shared with the payment modal. If the user already connected via your button, opening the payment modal and choosing Stellar won’t ask again.

---

## 3. What *not* to do

Avoid manually calling the kit for connection when you have already passed `stellarKit` to the provider.

```tsx
// ❌ Don’t: manual kit calls (can cause double confirmation)
const handleConnect = async (wallet) => {
  kit.setWallet(wallet.id);
  const { address } = await kit.getAddress();
  setPublicKey(address);
  await setConnector(wallet);
};

// ✅ Do: one SDK call
const handleConnect = async (wallet) => {
  await setConnector(wallet);
};
```

- **Don’t** call `kit.setWallet()` / `kit.getAddress()` yourself for the “connect” flow when using `useRozoConnectStellar()`.
- **Do** use `setConnector(wallet)` from `useRozoConnectStellar()` for connecting; the SDK will use the kit internally and keep state in sync.

---

## 4. `useRozoConnectStellar()` API

Use this hook inside a tree wrapped by `RozoPayProvider` (with or without your own `stellarKit`).

| Returned       | Type                     | Description |
|----------------|--------------------------|-------------|
| `kit`          | `StellarWalletsKit`      | The kit instance (yours or SDK’s). Use for e.g. `getSupportedWallets()`. |
| `isConnected`  | `boolean`                | Whether a Stellar wallet is connected. |
| `publicKey`    | `string \| undefined`   | Current Stellar public key. |
| `account`      | `AccountResponse \| undefined` | Horizon account for `publicKey`. |
| `connector`    | `ISupportedWallet \| undefined` | Currently connected wallet (e.g. Freighter, Albedo). |
| `setConnector` | `(wallet: ISupportedWallet) => Promise<void>` | **Use this to connect.** Calls the SDK’s `setWallet` (idempotent). |
| `setPublicKey` | `(pk: string) => void`   | Low-level; usually not needed if you use `setConnector`. |
| `disconnect`   | `() => Promise<void>`    | Disconnect and clear persisted wallet if persistence is on. |

---

## 5. Connecting inside the payment modal

When the user chooses a Stellar wallet **inside the SDK payment modal** (e.g. “Pay with Stellar” → “Albedo”), the SDK connects via the same `setWallet` logic. You don’t need to do anything extra; just ensure `stellarKit` is passed to `RozoPayProvider` so the modal can use your kit and avoid duplicate prompts.

---

## 6. Summary

1. Create **one** `StellarWalletsKit` at app root and pass it to `RozoPayProvider` as `stellarKit`.
2. For **custom connect UI**, use `useRozoConnectStellar()` and connect with **`await setConnector(wallet)`** only.
3. **Do not** call `kit.setWallet()` or `kit.getAddress()` yourself for the connect flow; use `setConnector(wallet)` so the SDK keeps behavior idempotent and avoids multiple confirmations.

For implementation details, see [STELLAR_PAYOUT_IMPLEMENTATION_ANALYSIS.md](./STELLAR_PAYOUT_IMPLEMENTATION_ANALYSIS.md). For general payment flow, see [ARCHITECTURE.md](./ARCHITECTURE.md).
