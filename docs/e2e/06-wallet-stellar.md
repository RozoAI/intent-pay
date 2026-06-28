# Stellar Source — Headless In-Page Signer

Stellar uses a different approach: the SDK accepts an injectable `stellarKit` prop,
so instead of automating a browser extension, a secret-key signer runs inside the
page. Playwright injects the secret at runtime — it never touches the app bundle or
any env var the app reads — so this signer cannot activate in production.

---

## 1. Constants module (kit-free, ESM-safe)

Keep wallet id and name in a separate file. Specs import from here, not from the
kit module. Importing the kit in a spec pulls in `@stellar/freighter-api`
(browser-only), which breaks under the test runner's ESM loader.

```ts
// lib/e2e-stellar-constants.ts
export const E2E_STELLAR_WALLET_ID = "e2e-headless"
export const E2E_STELLAR_WALLET_NAME = "E2E Headless Signer"
```

---

## 2. Headless kit (`lib/e2e-stellar-kit.ts`)

```ts
import {
  ModuleType, StellarWalletsKit, WalletNetwork, type ModuleInterface,
} from "@creit.tech/stellar-wallets-kit"
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk"
import { E2E_STELLAR_WALLET_ID, E2E_STELLAR_WALLET_NAME } from "./e2e-stellar-constants"

class HeadlessSecretKeyModule implements ModuleInterface {
  moduleType = ModuleType.HOT_WALLET
  productId   = E2E_STELLAR_WALLET_ID
  productName = E2E_STELLAR_WALLET_NAME
  productUrl  = "https://rozo.ai"
  productIcon = "https://rozo.ai/rozo-logo.png"
  private readonly keypair: Keypair

  constructor(secret: string) { this.keypair = Keypair.fromSecret(secret) }

  async isAvailable() { return true }
  async getAddress()  { return { address: this.keypair.publicKey() } }

  async signTransaction(xdr: string, opts?: { networkPassphrase?: string }) {
    const tx = TransactionBuilder.fromXDR(xdr, opts?.networkPassphrase ?? Networks.PUBLIC)
    tx.sign(this.keypair)
    return { signedTxXdr: tx.toXDR(), signerAddress: this.keypair.publicKey() }
  }

  async signAuthEntry(): Promise<never> { throw new Error("not supported") }
  async signMessage(): Promise<never>   { throw new Error("not supported") }
  async getNetwork() { return { network: "PUBLIC", networkPassphrase: Networks.PUBLIC } }
}

// Singleton — kit registers a custom element; constructing it twice throws.
let cachedKit: StellarWalletsKit | undefined

export function createHeadlessStellarKit(secret: string): StellarWalletsKit {
  if (cachedKit) return cachedKit
  cachedKit = new StellarWalletsKit({
    network: WalletNetwork.PUBLIC,
    selectedWalletId: E2E_STELLAR_WALLET_ID,
    modules: [new HeadlessSecretKeyModule(secret)],
  })
  return cachedKit
}
```

---

## 3. Wire the kit into your provider

In the component that renders `<RozoPayProvider />`, read the runtime-injected
window variable and pass the kit as the `stellarKit` prop. Use a `useState`
initializer so the kit is only constructed once per page load.

```tsx
import { createHeadlessStellarKit } from "@/lib/e2e-stellar-kit"
import type { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"

// Inside your provider component:
const [stellarKit] = useState<StellarWalletsKit | undefined>(() => {
  if (typeof window === "undefined") return undefined
  const secret = (window as Window & { __E2E_STELLAR_SECRET__?: string })
    .__E2E_STELLAR_SECRET__
  if (!secret) return undefined
  try {
    return createHeadlessStellarKit(secret)
  } catch (err) {
    console.error("[E2E] Failed to create headless Stellar kit:", err)
    return undefined
  }
})

return (
  <RozoPayProvider stellarKit={stellarKit} {/* ...other props */}>
    {children}
  </RozoPayProvider>
)
```

Because the kit only builds when `__E2E_STELLAR_SECRET__` is on `window` — and
Playwright is the only thing that sets it — the headless signer is impossible to
activate in a real user session.

---

## 4. Spec skeleton

```ts
// e2e/payment-flows/bridge/stellar-to-evm.spec.ts
import { test } from "@playwright/test"
import { E2E } from "../../env"
import { payInWithStellarHeadless, useStellarSigner, waitForPayoutCompleted } from "../../helpers"

test.describe("Bridge: Stellar → EVM (mainnet, real funds)", () => {
  test.skip(!E2E.stellar.secret, "E2E_STELLAR_SECRET not set")

  test("send USDC from Stellar to EVM", async ({ page }) => {
    // MUST run before any navigation — injects the secret before the page loads.
    await useStellarSigner(page, E2E.stellar.secret)

    // ── App-specific: open the SDK modal ────────────────────────────────────
    await openYourPaymentModal(page, {
      destChain: "Base",
      destToken: "USDC",
      address: E2E.evm.address,
      amount: E2E.amount,
    })
    // ───────────────────────────────────────────────────────────────────────

    await payInWithStellarHeadless(page)
    await waitForPayoutCompleted(page)
  })
})
```

**Deposit mode:** use `payInWithStellarHeadlessDeposit(page, "0.1")` instead of
`payInWithStellarHeadless(page)`. Minimum deposit is 0.1 USDC.

---

## Notes

- `useStellarSigner` uses `page.addInitScript` — it must be called before navigation.
- No browser extension needed; Stellar flows can run headless.
- Source wallet needs XLM for fees and USDC to send. Destination wallet needs a USDC trustline.
