import { describe, expect, it, vi, beforeEach } from "vitest";

const initMock = vi.fn();
const createAppKitMock = vi.fn();

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
    const fakeClient = {
      on: vi.fn(),
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

    const fakeClient = { on: vi.fn(), session: { values: [] } };
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
});
