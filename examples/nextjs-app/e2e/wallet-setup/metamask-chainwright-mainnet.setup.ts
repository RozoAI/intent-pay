import { defineWalletSetup } from "chainwright/core";
import { Metamask } from "chainwright/metamask";
import { existsSync } from "node:fs";

// Real-wallet MAINNET setup (Chainwright variant) — imports the seed phrase
// from .env.e2e (gitignored, copy from .env.e2e.example). NEVER commit a
// real seed phrase.
if (existsSync(".env.e2e")) {
  process.loadEnvFile(".env.e2e");
}

const SEED_PHRASE = process.env.E2E_SEED_PHRASE ?? "";
const PASSWORD = process.env.E2E_WALLET_PASSWORD ?? "TempE2ePassword123!";

export default defineWalletSetup(
  PASSWORD,
  async ({ walletPage }) => {
    const metamask = new Metamask(walletPage);

    await metamask.onboard({
      mode: "import",
      secretRecoveryPhrase: SEED_PHRASE,
      mainAccountName: "Account 1",
    });
  },
  {
    slowMo: 2000,
  },
);
