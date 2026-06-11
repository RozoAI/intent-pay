# EVM Source — MetaMask via chainwright

## Wallet setup

Run once to build a cached extension profile. Re-run after changing the seed phrase.

```ts
// e2e/wallet-setup/metamask.setup.ts
import { defineWalletSetup } from "chainwright/core"
import { Metamask } from "chainwright/metamask"
import { E2E } from "../env"

export default defineWalletSetup(
  E2E.evm.walletPassword,
  async ({ walletPage }) => {
    const metamask = new Metamask(walletPage)
    await metamask.onboard({
      mode: "import",
      secretRecoveryPhrase: E2E.evm.seedPhrase,
      mainAccountName: "Account 1",
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
// e2e/payment-flows/bridge/evm-to-solana.spec.ts
import { testWithChainwright } from "chainwright/core"
import { metamaskFixture } from "chainwright/metamask"
import { E2E } from "../../env"
import { payInWithMetaMask, waitForPayoutCompleted } from "../../helpers"

const test = testWithChainwright(metamaskFixture())

test.describe("Bridge: EVM → Solana (mainnet, real funds)", () => {
  test.skip(!E2E.evm.seedPhrase, "E2E_EVM_SEED_PHRASE not set")

  test("send USDC from EVM to Solana", async ({ page, metamask }) => {
    await metamask.unlock()

    // ── App-specific: open the SDK modal ────────────────────────────────────
    // Navigate, fill your form, click your pay button.
    // Contract: rozopay-modal must be visible when this block ends.
    await openYourPaymentModal(page, {
      destChain: "Solana",
      destToken: "USDC",
      address: E2E.solana.address,
      amount: E2E.amount,
    })
    // ───────────────────────────────────────────────────────────────────────

    await payInWithMetaMask(page, metamask, { sourceOptionId: E2E.evm.sourceOptionId })
    await waitForPayoutCompleted(page)
  })
})
```

The same `payInWithMetaMask` call works for Bridge, Checkout, and Deposit.
Only the "open modal" block differs per mode.

**Deposit:** no upfront amount in your form — pass it to the helper so the SDK
collects it on the in-modal amount screen:

```ts
await payInWithMetaMask(page, metamask, {
  sourceOptionId: E2E.evm.sourceOptionId,
  amount: "0.1", // minimum 0.1 USDC
})
```

---

## Notes

- MetaMask cannot load in headless mode — keep `headless: false` for all EVM projects.
- The cached profile starts **locked**; `metamask.unlock()` is required at the top of every test.
- The chain picker (EVM / Solana) only appears when both chains are offered. The
  `payInWithMetaMask` helper handles this with a best-effort click.
