import { useConnectors as useWagmiConnectors } from "wagmi";

export function useConnectors() {
  const connectors = useWagmiConnectors();
  return connectors ?? [];
}
