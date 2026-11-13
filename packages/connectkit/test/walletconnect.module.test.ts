import { describe, expect, it, vi, beforeEach } from "vitest";

const initMock = vi.fn();
const createAppKitMock = vi.fn();
const requestMock = vi.fn();

vi.mock("@walletconnect/universal-provider", () => ({
  UniversalProvider: { init: initMock },
  default: { init: initMock },
}));

vi.mock("@reown/appkit", () => ({
  createAppKit: createAppKitMock,
}));

vi.mock("@reown/appkit/networks", () => ({
  mainnet: { id: 1 },
}));

describe("WalletConnectModule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestMock.mockResolvedValue({ status: "success" });
    const fakeClient = {
      on: vi.fn(),
      request: requestMock,
      session: { values: [] },
    };
    const fakeProvider = { client: fakeClient };
    initMock.mockResolvedValue(fakeProvider);
    createAppKitMock.mockReturnValue({ open: vi.fn(), close: vi.fn() });
  });

  it("initializes exactly one WalletConnect Core via UniversalProvider.init", async () => {
    const { WalletConnectModule } = await import(
      "../src/utils/stellar/walletconnect.module.js"
    );

    new WalletConnectModule({
      projectId: "test-project-id",
      name: "Test",
      description: "Test",
      url: "https://test.example",
      icons: [],
      network: "Public Global Stellar Network ; September 2015",
    });

    await vi.waitFor(() => {
      expect(initMock).toHaveBeenCalledTimes(1);
    });
  });

  it("passes the UniversalProvider instance into createAppKit so AppKit reuses the same Core", async () => {
    const { WalletConnectModule } = await import(
      "../src/utils/stellar/walletconnect.module.js"
    );

    const fakeClient = {
      on: vi.fn(),
      request: requestMock,
      session: { values: [] },
    };
    const fakeProvider = { client: fakeClient };
    initMock.mockResolvedValue(fakeProvider);

    new WalletConnectModule({
      projectId: "test-project-id",
      name: "Test",
      description: "Test",
      url: "https://test.example",
      icons: [],
      network: "Public Global Stellar Network ; September 2015",
    });

    await vi.waitFor(() => {
      expect(createAppKitMock).toHaveBeenCalledTimes(1);
    });

    const callArgs = createAppKitMock.mock.calls[0][0];
    expect(callArgs.universalProvider).toBe(fakeProvider);
  });

  it("uses sign-and-submit when signTransaction receives submit", async () => {
    const {
      WalletConnectAllowedMethods,
      WalletConnectModule,
      WalletConnectTargetChain,
    } = await import("../src/utils/stellar/walletconnect.module.js");

    const module = new WalletConnectModule({
      projectId: "test-project-id",
      name: "Test",
      description: "Test",
      url: "https://test.example",
      icons: [],
      network: "Public Global Stellar Network ; September 2015",
    });

    await vi.waitFor(() => expect(createAppKitMock).toHaveBeenCalledTimes(1));
    module.setSession("test-topic");

    await expect(
      module.signTransaction("transaction-xdr", {
        networkPassphrase:
          "Public Global Stellar Network ; September 2015",
        submit: true,
      }),
    ).resolves.toEqual({
      signedTxXdr: "transaction-xdr",
      submitted: true,
      submissionStatus: "success",
    });
    expect(requestMock).toHaveBeenCalledWith({
      topic: "test-topic",
      chainId: WalletConnectTargetChain.PUBLIC,
      request: {
        method: WalletConnectAllowedMethods.SIGN_AND_SUBMIT,
        params: { xdr: "transaction-xdr" },
      },
    });
  });

  async function startModule() {
    const mod = await import("../src/utils/stellar/walletconnect.module.js");
    const module = new mod.WalletConnectModule({
      projectId: "test-project-id",
      name: "Test",
      description: "Test",
      url: "https://test.example",
      icons: [],
      network: "Public Global Stellar Network ; September 2015",
    });
    await vi.waitFor(() => expect(createAppKitMock).toHaveBeenCalled());
    module.setSession("test-topic");
    return module;
  }

  const submitOpts = {
    networkPassphrase: "Public Global Stellar Network ; September 2015",
    submit: true,
  };

  it.each([
    ["missing status", {}],
    ["undefined response", undefined],
    ["unexpected status", { status: "error" }],
  ])(
    "reports outcome unknown instead of throwing on %s",
    async (_label, response) => {
      requestMock.mockResolvedValueOnce(response);
      const module = await startModule();
      await expect(
        module.signTransaction("transaction-xdr", submitOpts),
      ).resolves.toEqual({
        signedTxXdr: "transaction-xdr",
        submitted: false,
        submissionStatus: "unknown",
      });
    },
  );

  it("reports pending as not submitted", async () => {
    requestMock.mockResolvedValueOnce({ status: "pending" });
    const module = await startModule();
    await expect(
      module.signTransaction("transaction-xdr", submitOpts),
    ).resolves.toMatchObject({ submitted: false, submissionStatus: "pending" });
  });

  it("treats a non-rejection wallet error as outcome unknown", async () => {
    requestMock.mockRejectedValueOnce({
      code: -1,
      message: "Horizon request timed out",
    });
    const module = await startModule();
    await expect(
      module.signTransaction("transaction-xdr", submitOpts),
    ).resolves.toMatchObject({ submitted: false, submissionStatus: "unknown" });
  });

  it.each([
    [{ code: 5000, message: "User rejected." }],
    [{ code: -4, message: "The user rejected this request." }],
    [{ code: 1, message: "User cancelled the request" }],
  ])("still throws on an explicit user rejection %o", async (error) => {
    requestMock.mockRejectedValueOnce(error);
    const module = await startModule();
    await expect(
      module.signTransaction("transaction-xdr", submitOpts),
    ).rejects.toMatchObject({ message: error.message });
  });
});
