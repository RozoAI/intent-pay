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

/**
 * In-memory store for WalletConnect session paths (publicKey → topic mappings).
 * Replaces the previous `activeSession` string so signTransaction can find the
 * correct session by the signer's public key rather than relying on a single
 * stored topic that can go stale.
 */
let wcSessionPaths: Array<{ publicKey: string; topic: string }> = [];

export class WalletConnectModule implements ModuleInterface {
  moduleType: ModuleType = "BRIDGE_WALLET" as ModuleType;

  productId: string = WALLET_CONNECT_ID;
  productName: string = "WalletConnect";
  productUrl: string = "https://walletconnect.com/";
  productIcon: string =
    "https://stellar.creit.tech/wallet-icons/walletconnect.png";

  modal!: ReturnType<typeof createAppKit>;
  signClient!: Client;

  constructor(public wcParams: IWalletConnectConstructorParams) {
    // Initialize SignClient first — this creates exactly ONE WalletConnect Core.
    // createAppKit() is called after so it reuses the same Core instance via
    // manualWCControl, avoiding the "WalletConnect Core is already initialized"
    // double-init that caused key-store mismatches and relay decryption failures.
    SignClient.init({
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
          wcSessionPaths = wcSessionPaths.filter((p) => p.topic !== ev.topic);
        });

        this.signClient = client;

        if (wcParams.onSessionDeleted) {
          client.on("session_delete", (ev: { topic: string }) => {
            wcParams.onSessionDeleted!(ev.topic);
          });
        }
      })
      .catch(console.error);

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
    return !!this.signClient && !!this.modal;
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

  async getAddress(): Promise<{ address: string }> {
    await this.runChecks();

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

    try {
      const session: SessionTypes.Struct = await approval();
      const accounts: string[] = session.namespaces.stellar.accounts.map(
        (account: string) => account.split(":")[2],
      );

      // Store publicKey → topic mappings for use in signTransaction.
      wcSessionPaths = [
        ...wcSessionPaths,
        ...accounts.map((publicKey: string) => ({
          publicKey,
          topic: session.topic,
        })),
      ];

      this.modal.close();
      return { address: accounts[0] };
    } catch (e) {
      this.modal.close();
      throw parseError(e as Error);
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
      wcSessionPaths.push({ publicKey: "", topic: sessionId });
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
    wcSessionPaths = wcSessionPaths.filter((p) => p.topic !== sessionId);
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
