import { defineWalletSetup } from "chainwright/core"
import { Metamask } from "chainwright/metamask"
import { E2E } from "../env"

// Real-wallet MAINNET setup — imports the EVM seed phrase from .env.e2e (loaded
// via ../env). NEVER commit a real seed phrase.
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
  {
    slowMo: 2000,
  }
)
