# Solana Source — Phantom via chainwright

## Wallet setup

Run once to build a cached extension profile. Re-run after changing the seed phrase.

```ts
// e2e/wallet-setup/phantom.setup.ts
import { defineWalletSetup } from "chainwright/core"
import { Phantom } from "chainwright/phantom"
import { E2E } from "../env"

export default defineWalletSetup(
  E2E.solana.walletPassword,
  async ({ walletPage }) => {
    const phantom = new Phantom(walletPage)
    await phantom.onboard({
      mode: "recovery phrase",
      secretRecoveryPhrase: E2E.solana.seedPhrase,
      accountName: "Account 1",
      toggleNetworkMode: { mode: "off" }, // disable testnet → forces Solana mainnet
    })
  },
  { slowMo: 2000 }
)
```

```bash
pnpm setup-wallets
```

---

## Spec skeleton

```ts
// e2e/payment-flows/bridge/solana-to-stellar.spec.ts
import { testWithChainwright } from "chainwright/core"
import { phantomFixture } from "chainwright/phantom"
import { E2E } from "../../env"
import { payInWithPhantom, unlockPhantomIfNeeded, waitForPayoutCompleted } from "../../helpers"

const test = testWithChainwright(phantomFixture())

test.describe("Bridge: Solana → Stellar (mainnet, real funds)", () => {
  test.skip(!E2E.solana.seedPhrase, "E2E_SOLANA_SEED_PHRASE not set")

  test("send USDC from Solana to Stellar", async ({ page, phantom, phantomPage }) => {
    // Phantom's cached profile often starts unlocked — only unlock if needed.
    await unlockPhantomIfNeeded(phantom, phantomPage)

    // ── App-specific: open the SDK modal ────────────────────────────────────
    // Navigate, fill your form, click your pay button.
    // Contract: rozopay-modal must be visible when this block ends.
    await openYourPaymentModal(page, {
      destChain: "Stellar",
      destToken: "USDC",
      address: E2E.stellar.address,
      amount: E2E.amount,
    })
    // ───────────────────────────────────────────────────────────────────────

    await payInWithPhantom(page, phantom, { sourceOptionId: E2E.solana.sourceOptionId })
    await waitForPayoutCompleted(page)
  })
})
```

The same `payInWithPhantom` call works for Bridge, Checkout, and Deposit.

**Deposit:** pass `amount` so it's entered on the in-modal amount screen:

```ts
await payInWithPhantom(page, phantom, {
  sourceOptionId: E2E.solana.sourceOptionId,
  amount: "0.1", // minimum 0.1 USDC
})
```

---

## Notes

- Phantom cannot load in headless mode — keep `headless: false` for all Solana projects.
- Phantom is multi-chain. When both EVM and Solana are offered, the SDK may show a
  chain picker after wallet selection. `payInWithPhantom` handles this best-effort.
- Unlike MetaMask, Phantom's cached profile frequently starts **unlocked**.
  Always use `unlockPhantomIfNeeded` instead of `phantom.unlock()` directly.
- The Solana wallet setup sets `toggleNetworkMode: { mode: "off" }` to disable
  testnet. Verify this is present if you rebuild the cached profile.
