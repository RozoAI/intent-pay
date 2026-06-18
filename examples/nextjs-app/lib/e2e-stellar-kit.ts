/**
 * E2E-only headless Stellar signer.
 *
 * Builds a `StellarWalletsKit` backed by a raw secret key so Playwright can
 * drive the Stellar → EVM pay-in flow WITHOUT a Freighter (or any) browser
 * extension. Signing happens in-page with @stellar/stellar-sdk — no popups,
 * no extension automation.
 *
 * ─── SECURITY ──────────────────────────────────────────────────────────────
 * This signs with a real Stellar secret key in-page. The secret is ONLY ever
 * provided at runtime by Playwright (window.__E2E_STELLAR_SECRET__); there is no
 * env-var path, so this kit can never be constructed in the real playground or
 * production. Use a throwaway wallet that holds only small test amounts. Treat
 * the secret like any other E2E credential.
 */
import {
  ModuleType,
  StellarWalletsKit,
  WalletNetwork,
  type ModuleInterface,
} from "@creit.tech/stellar-wallets-kit"
import { Keypair, Networks, TransactionBuilder } from "@stellar/stellar-sdk"
import {
  E2E_STELLAR_WALLET_ID,
  E2E_STELLAR_WALLET_NAME,
} from "./e2e-stellar-constants"

export { E2E_STELLAR_WALLET_ID, E2E_STELLAR_WALLET_NAME }

/**
 * A StellarWalletsKit module that signs locally with a secret key instead of
 * delegating to a browser wallet. Implements just enough of ModuleInterface
 * for the RozoPay Stellar pay-in flow: getAddress + signTransaction.
 */
class HeadlessSecretKeyModule implements ModuleInterface {
  moduleType = ModuleType.HOT_WALLET
  productId = E2E_STELLAR_WALLET_ID
  productName = E2E_STELLAR_WALLET_NAME
  productUrl = "https://rozo.ai"
  productIcon = "https://rozo.ai/rozo-logo.png"

  private readonly keypair: Keypair

  constructor(secret: string) {
    this.keypair = Keypair.fromSecret(secret)
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async getAddress(): Promise<{ address: string }> {
    return { address: this.keypair.publicKey() }
  }

  async signTransaction(
    xdr: string,
    opts?: { networkPassphrase?: string }
  ): Promise<{ signedTxXdr: string; signerAddress: string }> {
    const passphrase = opts?.networkPassphrase ?? Networks.PUBLIC
    const tx = TransactionBuilder.fromXDR(xdr, passphrase)
    tx.sign(this.keypair)
    return {
      signedTxXdr: tx.toXDR(),
      signerAddress: this.keypair.publicKey(),
    }
  }

  async signAuthEntry(): Promise<{
    signedAuthEntry: string
    signerAddress: string
  }> {
    throw new Error("signAuthEntry is not supported by the E2E headless signer")
  }

  async signMessage(): Promise<{
    signedMessage: string
    signerAddress: string
  }> {
    throw new Error("signMessage is not supported by the E2E headless signer")
  }

  async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    return { network: "PUBLIC", networkPassphrase: Networks.PUBLIC }
  }
}

// Singleton — StellarWalletsKit registers a custom element, so it must only be
// constructed once per page (guards against React Strict Mode double-invoke).
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
