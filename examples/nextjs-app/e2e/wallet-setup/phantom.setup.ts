import { defineWalletSetup } from "chainwright/core"
import { Phantom } from "chainwright/phantom"
import { E2E } from "../env"

// Real-wallet MAINNET setup — imports the Solana SOURCE recovery phrase from
// .env.e2e (loaded via ../env) into a cached Phantom profile, and ensures the
// wallet is on Solana mainnet (testnet mode off). NEVER commit a real phrase.
export default defineWalletSetup(
  E2E.solana.walletPassword,
  async ({ walletPage }) => {
    const phantom = new Phantom(walletPage)

    await phantom.onboard({
      mode: "recovery phrase",
      secretRecoveryPhrase: E2E.solana.seedPhrase,
      accountName: "Account 1",
      // Disable testnet mode → Solana mainnet (idempotent if already off).
      toggleNetworkMode: { mode: "off" },
    })
  },
  {
    slowMo: 2000,
  }
)
