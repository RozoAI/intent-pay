import { type Connector, useConnectors as useWagmiConnectors } from "wagmi";

export function useConnectors() {
  const connectors = useWagmiConnectors();
  return connectors ?? [];
}

export function useConnector(id: string, uuid?: string) {
  const connectors = useConnectors();
  if (id === "injected" && uuid) {
    return connectors.find((c) => c.id === id && c.name === uuid) as Connector;
  } else if (id === "injected") {
    return connectors.find(
      (c) => c.id === id && c.name.includes("Injected"),
    ) as Connector;
  }
  return connectors.find((c) => c.id === id) as Connector;
}
