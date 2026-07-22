import type {
  ModuleInterface,
  ModuleType,
} from "@creit.tech/stellar-wallets-kit";
import { CreateAppKit, createAppKit } from "@reown/appkit";
import type { SignClientTypes } from "@walletconnect/types";
import { type default as Client, SignClient } from "@walletconnect/sign-client";
import type { SessionTypes } from "@walletconnect/types";
import { parseError } from "../index";
import { mainnet } from "@reown/appkit/networks";

declare const window: Window &
  typeof globalThis & {
    stellar?: {
      provider: string;
      platform: string;
      version: string;
    };
  };

export const WALLET_CONNECT_ID = "wallet_connect";

const PUBLIC_NETWORK_NAME = "Public Global Stellar Network ; September 2015";
const WC_SESSION_PATHS_KEY = "rozo_wc_session_paths";

/**
 * In-memory store for WalletConnect session paths (publicKey → topic mappings).
 * Persisted to localStorage so sessions survive page reloads.
 */
let wcSessionPaths: Array<{ publicKey: string; topic: string }> =
  loadSessionPaths();

function loadSessionPaths(): Array<{ publicKey: string; topic: string }> {
  try {
    const raw = localStorage.getItem(WC_SESSION_PATHS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persistSessionPaths(): void {
  try {
    localStorage.setItem(WC_SESSION_PATHS_KEY, JSON.stringify(wcSessionPaths));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

function removeSessionPath(topic: string): void {
  wcSessionPaths = wcSessionPaths.filter((p) => p.topic !== topic);
  persistSessionPaths();
}

function addSessionPaths(
  entries: Array<{ publicKey: string; topic: string }>,
): void {
  wcSessionPaths = [...wcSessionPaths, ...entries];
  persistSessionPaths();
}

export class WalletConnectModule implements ModuleInterface {
  moduleType: ModuleType = "BRIDGE_WALLET" as ModuleType;

  productId: string = WALLET_CONNECT_ID;
  productName: string = "WalletConnect";
  productUrl: string = "https://walletconnect.com/";
  productIcon: string =
    "https://stellar.creit.tech/wallet-icons/walletconnect.png";

  modal!: ReturnType<typeof createAppKit>;
  signClient!: Client;
  private signClientReady: Promise<void>;

  constructor(public wcParams: IWalletConnectConstructorParams) {
    // Initialize SignClient first — this creates exactly ONE WalletConnect Core.
    // createAppKit() is called after so it reuses the same Core instance via
    // manualWCControl, avoiding the "WalletConnect Core is already initialized"
    // double-init that caused key-store mismatches and relay decryption failures.
    this.signClientReady = SignClient.init({
      projectId: wcParams.projectId,
      metadata: {
        name: wcParams.name,
        url: wcParams.url,
        description: wcParams.description,
        icons: wcParams.icons,
      },
      ...(wcParams.signClientOptions || {}),
    })
      .then((client): void => {
        // Forward the WalletConnect URI to the AppKit modal automatically.
        (
          client as Client & {
            on: (e: string, cb: (uri: string) => void) => void;
          }
        ).on("display_uri", (uri: string): void => {
          this.modal.open({ uri });
        });

        // Clean up session paths when a session is deleted from the wallet side.
        client.on("session_delete", (ev: { topic: string }): void => {
          removeSessionPath(ev.topic);
        });

        this.signClient = client;

        // Restore session paths from persisted storage, validating against
        // live sessions. Stale entries (sessions the wallet closed while the
        // page was unloaded) are discarded.
        this.restorePersistedSessions();

        if (wcParams.onSessionDeleted) {
          client.on("session_delete", (ev: { topic: string }) => {
            wcParams.onSessionDeleted!(ev.topic);
          });
        }
      })
      .catch(console.error);
    // ponytail: fire-and-forget — signClientReady lets isAvailable() await

    // AppKit is used only for the QR-code modal UI. manualWCControl: true tells
    // it not to create its own WalletConnect Core — it reuses the one SignClient
    // already created above.
    this.modal = createAppKit({
      projectId: wcParams.projectId,
      manualWCControl: true,
      enableReconnect: true,
      // mainnet is required by AppKit types; Stellar sessions are handled
      // entirely through the SignClient, not through AppKit adapters.
      networks: [mainnet as any],
      metadata: {
        name: wcParams.name,
        url: wcParams.url,
        description: wcParams.description,
        icons: wcParams.icons,
      },
      featuredWalletIds: [
        // Freighter
        "997a355c8f682468706a76cff1b004a7115f505fb962dac54b6e9b442dd1c380",
        // Lobstr
        "76a3d548a08cf402f5c7d021f24fd2881d767084b387a5325df88bc3d4b6f21b",
      ],
      ...(wcParams.appKitOptions || {}),
    });
  }

  async isAvailable(): Promise<boolean> {
    if (!this.modal) return false;
    await this.signClientReady;
    return !!this.signClient;
  }

  async isPlatformWrapper(): Promise<boolean> {
    const options: Array<{ provider: string; platform: string }> = [
      { provider: "freighter", platform: "mobile" },
    ];
    return !!options.find(
      ({ provider, platform }) =>
        window.stellar?.provider === provider &&
        window.stellar?.platform === platform,
    );
  }

  private async runChecks(): Promise<void> {
    if (!(await this.isAvailable())) {
      throw parseError(
        new Error("WalletConnect module has not been started yet."),
      );
    }
  }

  /**
   * Restore wcSessionPaths from localStorage and validate against live
   * WalletConnect sessions. Removes stale entries whose sessions no longer
   * exist in signClient.session.values.
   */
  private restorePersistedSessions(): void {
    if (!this.signClient) return;
    const liveTopics = new Set(
      this.signClient.session.values.map((s) => s.topic),
    );
    const valid = wcSessionPaths.filter((p) => liveTopics.has(p.topic));
    if (valid.length !== wcSessionPaths.length) {
      wcSessionPaths = valid;
      persistSessionPaths();
    }
  }

  /**
   * Check for an existing valid WalletConnect session for the given address.
   * Returns the address if a live session exists, null otherwise.
   */
  private getExistingSession(
    address?: string,
  ): { address: string } | null {
    if (!this.signClient) return null;
    const liveTopics = new Set(
      this.signClient.session.values.map((s) => s.topic),
    );
    // Filter paths to only those backed by a live session
    const live = wcSessionPaths.filter((p) => liveTopics.has(p.topic));
    if (live.length === 0) return null;

    const match = address
      ? live.find((p) => p.publicKey === address)
      : live[0];
    if (match && match.publicKey) return { address: match.publicKey };
    return null;
  }

  async getAddress(): Promise<{ address: string }> {
    await this.runChecks();

    // Reuse existing session if available
    const existing = this.getExistingSession();
    if (existing) return existing;

    const { uri, approval } = await this.signClient.connect({
      requiredNamespaces: {
        stellar: {
          methods: [WalletConnectAllowedMethods.SIGN],
          chains: wcParams_allowedChains(this.wcParams),
          events: [],
        },
      },
      optionalNamespaces: {
        stellar: {
          methods: [WalletConnectAllowedMethods.SIGN_AND_SUBMIT],
          chains: wcParams_allowedChains(this.wcParams),
          events: [],
        },
      },
    });

    if (uri) {
      this.modal.open({ uri });
    }

    // Reject when the user closes the AppKit modal without scanning.
    // AppKit doesn't expose a close event, so we watch the DOM for the
    // modal element being removed (the <appkit-modal> web component).
    let modalObserver: MutationObserver | undefined;
    const modalClosed = new Promise<never>((_, reject) => {
      const selector = "appkit-modal, w3m-modal, [data-testid='appkit-modal']";
      const found = document.querySelector(selector);
      if (!found) return; // modal not in DOM — approval() will handle it

      modalObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of Array.from(m.removedNodes)) {
            if (
              node === found ||
              (node instanceof HTMLElement && node.matches?.(selector))
            ) {
              modalObserver?.disconnect();
              reject(
                parseError(
                  new Error("Connection cancelled — modal was closed."),
                ),
              );
              return;
            }
          }
        }
      });
      modalObserver.observe(document.body, { childList: true, subtree: true });
    });

    try {
      const session: SessionTypes.Struct = await Promise.race([
        approval(),
        modalClosed,
      ]);
      const accounts: string[] = session.namespaces.stellar.accounts.map(
        (account: string) => account.split(":")[2],
      );

      // Store publicKey → topic mappings for use in signTransaction.
      addSessionPaths(
        accounts.map((publicKey: string) => ({
          publicKey,
          topic: session.topic,
        })),
      );

      this.modal.close();
      return { address: accounts[0] };
    } catch (e) {
      this.modal.close();
      throw parseError(e as Error);
    } finally {
      // Always clean up the observer to avoid leaks
      modalObserver?.disconnect();
    }
  }

  async signTransaction(
    xdr: string,
    opts?: {
      networkPassphrase?: string;
      address?: string;
      path?: string;
      submit?: boolean;
      submitUrl?: string;
    },
  ): Promise<{ signedTxXdr: string; signerAddress?: string }> {
    await this.runChecks();

    // Find the session for the requested signer address.
    // Falls back to the first available session if no address is specified.
    const targetPath =
      wcSessionPaths.find((p) => p.publicKey === opts?.address) ??
      wcSessionPaths[0];

    if (!targetPath) {
      throw parseError(
        new Error(
          "No WalletConnect session found or it expired for the selected address.",
        ),
      );
    }

    const chainId =
      opts?.networkPassphrase === PUBLIC_NETWORK_NAME
        ? WalletConnectTargetChain.PUBLIC
        : WalletConnectTargetChain.TESTNET;

    const result = await this.signClient
      .request<{ signedXDR: string }>({
        topic: targetPath.topic,
        chainId,
        request: {
          method: WalletConnectAllowedMethods.SIGN,
          params: { xdr },
        },
      })
      .catch((e: unknown) => {
        throw parseError(e as Error);
      });

    return { signedTxXdr: result.signedXDR };
  }

  async signAuthEntry(): Promise<{
    signedAuthEntry: string;
    signerAddress?: string;
  }> {
    throw {
      code: -3,
      message: 'WalletConnect does not support the "signAuthEntry" function',
    };
  }

  async signMessage(): Promise<{
    signedMessage: string;
    signerAddress?: string;
  }> {
    throw {
      code: -3,
      message: 'WalletConnect does not support the "signMessage" function',
    };
  }

  async getNetwork(): Promise<{ network: string; networkPassphrase: string }> {
    throw {
      code: -3,
      message: 'WalletConnect does not support the "getNetwork" function',
    };
  }

  public setSession(sessionId: string) {
    // Legacy compat: add a synthetic path entry so existing callers that
    // pass a sessionId still work. The publicKey is unknown here so we
    // store an empty string; signTransaction will still match via topic
    // when no address is provided.
    if (!wcSessionPaths.find((p) => p.topic === sessionId)) {
      addSessionPaths([{ publicKey: "", topic: sessionId }]);
    }
  }

  public onSessionDeleted(cb: (sessionId: string) => void) {
    if (!this.signClient) {
      throw new Error("WalletConnect is not running yet");
    }
    this.signClient.on("session_delete", (data: { topic: string }) => {
      cb(data.topic);
    });
  }

  /** @deprecated Use getAddress() which handles connection automatically. */
  public async connectWalletConnect(): Promise<IParsedWalletConnectSession> {
    return this.getAddress().then((r) => {
      const path = wcSessionPaths.find((p) => p.publicKey === r.address);
      return {
        id: path?.topic ?? "",
        name: this.wcParams.name,
        description: this.wcParams.description,
        url: this.wcParams.url,
        icons: this.wcParams.icons[0] ?? "",
        accounts: [{ network: "pubnet" as const, publicKey: r.address }],
      };
    });
  }

  async disconnect(): Promise<void> {
    if (!this.signClient) {
      throw new Error("WalletConnect is not running yet");
    }
    const sessions = this.signClient.session.values;
    for (const session of sessions) {
      await this.closeSession(session.topic);
    }
  }

  public async closeSession(sessionId: string, reason?: string): Promise<void> {
    if (!this.signClient) {
      throw new Error("WalletConnect is not running yet");
    }
    removeSessionPath(sessionId);
    await this.signClient.disconnect({
      topic: sessionId,
      reason: { message: reason ?? "Session closed", code: -1 },
    });
  }

  public async getSessions(): Promise<IParsedWalletConnectSession[]> {
    if (!this.signClient) {
      throw new Error("WalletConnect is not running yet");
    }
    return this.signClient.session.values.map(parseWalletConnectSession);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wcParams_allowedChains(
  params: IWalletConnectConstructorParams,
): WalletConnectTargetChain[] {
  if (params.allowedChains) return params.allowedChains;
  return params.network === PUBLIC_NETWORK_NAME
    ? [WalletConnectTargetChain.PUBLIC]
    : [WalletConnectTargetChain.TESTNET];
}

const parseWalletConnectSession = (
  session: SessionTypes.Struct,
): IParsedWalletConnectSession => {
  const accounts = session.namespaces.stellar.accounts.map(
    (account: string) => ({
      network: account.split(":")[1] as "pubnet" | "testnet",
      publicKey: account.split(":")[2],
    }),
  );
  return {
    id: session.topic,
    name: session.peer.metadata.name,
    description: session.peer.metadata.description,
    url: session.peer.metadata.url,
    icons: session.peer.metadata.icons[0],
    accounts,
  };
};

// ---------------------------------------------------------------------------
// Types & enums
// ---------------------------------------------------------------------------

export interface IParsedWalletConnectSession {
  id: string;
  name: string;
  description: string;
  url: string;
  icons: string;
  accounts: Array<{
    network: "pubnet" | "testnet";
    publicKey: string;
  }>;
}

export interface IWalletConnectConstructorParams {
  projectId: string;
  name: string;
  description: string;
  url: string;
  icons: string[];
  /** @deprecated method is now always SIGN; kept for backwards compat */
  method?: WalletConnectAllowedMethods;
  network: string;
  allowedChains?: WalletConnectTargetChain[];
  sessionId?: string;
  signClientOptions?: SignClientTypes.Options;
  appKitOptions?: Partial<CreateAppKit>;
  onSessionDeleted?: (sessionId: string) => void;
}

export enum WalletConnectTargetChain {
  PUBLIC = "stellar:pubnet",
  TESTNET = "stellar:testnet",
}

export enum WalletConnectAllowedMethods {
  SIGN = "stellar_signXDR",
  SIGN_AND_SUBMIT = "stellar_signAndSubmitXDR",
}
