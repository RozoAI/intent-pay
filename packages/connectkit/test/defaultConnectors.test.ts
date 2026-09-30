import { describe, expect, it } from "vitest";
import { createConfig, http } from "wagmi";
import type { CreateConnectorFn } from "wagmi";
import { mainnet } from "wagmi/chains";

import defaultConnectors from "../src/defaultConnectors";

const app = { name: "Test App" };

describe("defaultConnectors", () => {
  it("includes Coinbase and injected connectors without EVM WalletConnect", () => {
    const config = createConfig({
      chains: [mainnet],
      transports: { [mainnet.id]: http() },
      connectors: defaultConnectors({ app }),
    });
    const ids = config.connectors.map((connector) => connector.id);

    expect(ids).toEqual(expect.arrayContaining(["coinbaseWalletSDK", "injected"]));
    expect(ids).not.toContain("walletConnect");
  });

  it("preserves caller-provided additional connectors", () => {
    const additionalConnector = (() => ({
      id: "custom",
      name: "Custom",
      type: "mock",
    })) as unknown as CreateConnectorFn;

    const connectors = defaultConnectors({
      app,
      additionalConnectors: [additionalConnector],
    });

    expect(connectors[0]).toBe(additionalConnector);
  });
});
