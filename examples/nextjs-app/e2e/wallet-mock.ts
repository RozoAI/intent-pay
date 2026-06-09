/**
 * Injects a fake EIP-1193 window.ethereum provider before page load.
 * Handles the minimal JSON-RPC surface wagmi's injected connector needs:
 *   eth_requestAccounts, eth_accounts, eth_chainId, net_version,
 *   wallet_switchEthereumChain, wallet_addEthereumChain,
 *   eth_sendTransaction, eth_getTransactionReceipt,
 *   eth_estimateGas, eth_gasPrice, eth_getBalance,
 *   eth_blockNumber, eth_call, eth_getCode
 *
 * Uses Base mainnet (chainId 0x2105 = 8453) to match CFG in specs.
 */
export const MOCK_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
export const MOCK_TX_HASH =
  "0xaabbccddeeff00112233445566778899aabbccddeeff00112233445566778899"
export const MOCK_CHAIN_ID = "0x2105" // Base = 8453

export const injectWalletScript = `
(function () {
  const ADDR = "${MOCK_ADDRESS}";
  const CHAIN = "${MOCK_CHAIN_ID}";
  const TX = "${MOCK_TX_HASH}";

  const emitter = { _handlers: {}, on(e, fn) { (this._handlers[e] = this._handlers[e] || []).push(fn); }, emit(e, ...a) { (this._handlers[e] || []).forEach(fn => fn(...a)); } };

  window.ethereum = {
    isMetaMask: true,
    selectedAddress: ADDR,
    chainId: CHAIN,
    networkVersion: "8453",
    on: emitter.on.bind(emitter),
    removeListener() {},

    request({ method, params }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts":
          return Promise.resolve([ADDR]);

        case "eth_chainId":
          return Promise.resolve(CHAIN);

        case "net_version":
          return Promise.resolve("8453");

        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
          emitter.emit("chainChanged", (params && params[0] && params[0].chainId) || CHAIN);
          return Promise.resolve(null);

        case "eth_sendTransaction":
          return Promise.resolve(TX);

        case "eth_getTransactionReceipt":
          return Promise.resolve({
            transactionHash: TX,
            blockNumber: "0x1",
            blockHash: "0x" + "ab".repeat(32),
            status: "0x1",
            gasUsed: "0x5208",
            logs: [],
          });

        case "eth_estimateGas":
          return Promise.resolve("0x5208");

        case "eth_gasPrice":
          return Promise.resolve("0x3b9aca00");

        case "eth_getBalance":
          return Promise.resolve("0x16345785d8a0000"); // 0.1 ETH

        case "eth_blockNumber":
          return Promise.resolve("0x12345");

        case "eth_call":
          // ERC-20 balanceOf — return ~100 USDC (6 decimals)
          return Promise.resolve("0x0000000000000000000000000000000000000000000000000000000005F5E100");

        case "eth_getCode":
          return Promise.resolve("0x");

        default:
          return Promise.reject(new Error(\`[mock-eth] unhandled: \${method}\`));
      }
    },

    // legacy send/sendAsync shims
    send(payload, cb) {
      this.request(payload).then(r => cb(null, { id: payload.id, jsonrpc: "2.0", result: r })).catch(e => cb(e));
    },
    sendAsync(payload, cb) { this.send(payload, cb); },
  };

  // Announce as EIP-6963 provider so wagmi's injected connector picks it up
  const info = { uuid: "mock-metamask-uuid", name: "MetaMask", icon: "data:image/svg+xml,<svg/>", rdns: "io.metamask" };
  window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider: window.ethereum }) }));
  window.addEventListener("eip6963:requestProvider", () => {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info, provider: window.ethereum }) }));
  });
})();
`
