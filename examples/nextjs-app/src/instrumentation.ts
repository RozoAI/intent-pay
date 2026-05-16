/**
 * Runs once on server startup (Node.js and Edge runtimes).
 *
 * Some wallet SDKs (WalletConnect, Reown AppKit, MetaMask SDK, and others)
 * touch `localStorage` at module import time. Their own guards work for
 * `typeof localStorage === 'undefined'`, but something in the dependency
 * graph assigns a partial shim that is defined but not functional, which
 * makes the SDKs crash with `localStorage.getItem is not a function`.
 *
 * We install a complete no-op shim on the server so those modules can load
 * without crashing. It never runs in the browser because Next.js tree-shakes
 * the Node.js branch out of the client bundle.
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const g = globalThis as Record<string, unknown>;
    if (
      typeof g.localStorage === "undefined" ||
      typeof (g.localStorage as { getItem?: unknown }).getItem !== "function"
    ) {
      const store = new Map<string, string>();
      g.localStorage = {
        getItem: (k: string) => (store.has(k) ? (store.get(k) ?? null) : null),
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() {
          return store.size;
        },
      };
    }
  }
}
