import { APP_ID } from "@/app/const";
import type { Token } from "@rozoai/intent-common";
import {
  // chains
  arbitrum,
  arbitrumDAI,
  // tokens
  arbitrumETH,
  arbitrumUSDC,
  arbitrumUSDT,
  arbitrumWETH,
  avalanche,
  avalancheAVAX,
  base,
  baseETH,
  baseEURC,
  baseUSDC,
  bsc,
  bscBNB,
  celo,
  ethereum,
  ethereumETH,
  getChainById,
  getKnownToken,
  gnosis,
  gnosisXDAI,
  hyperEVM,
  linea,
  lineaETH,
  mantle,
  mantleMNT,
  optimism,
  optimismETH,
  polygon,
  polygonPOL,
  rozoSolana,
  rozoSolanaUSDC,
  rozoSolanaUSDT,
  rozoStellar,
  rozoStellarEURC,
  rozoStellarUSDC,
  solana,
  solanaSOL,
  solanaUSDC,
  solanaUSDT,
  solanaWSOL,
  stellar,
  stellarUSDC,
  stellarXLM,
  TokenSymbol,
  worldchain,
  worldchainETH,
  worldchainUSDC,
} from "@rozoai/intent-common";

export interface BridgeConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
}

export type CheckoutConfig = BridgeConfig;

export interface DepositConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
}

// Map chainId → constant name used in generated snippets
const CHAIN_CONST: Record<number, string> = {
  [arbitrum.chainId]: "arbitrum",
  [base.chainId]: "base",
  [bsc.chainId]: "bsc",
  [celo.chainId]: "celo",
  [ethereum.chainId]: "ethereum",
  [linea.chainId]: "linea",
  [mantle.chainId]: "mantle",
  [optimism.chainId]: "optimism",
  [polygon.chainId]: "polygon",
  [solana.chainId]: "solana",
  [stellar.chainId]: "stellar",
  [worldchain.chainId]: "worldchain",
  [gnosis.chainId]: "gnosis",
  [avalanche.chainId]: "avalanche",
  [hyperEVM.chainId]: "hyperEVM",
  [rozoSolana.chainId]: "rozoSolana",
  [rozoStellar.chainId]: "rozoStellar",
};

// All known token constants for lookup
const KNOWN_TOKENS: Array<{ name: string; token: Token }> = [
  { name: "arbitrumETH", token: arbitrumETH },
  { name: "arbitrumWETH", token: arbitrumWETH },
  { name: "arbitrumUSDC", token: arbitrumUSDC },
  { name: "arbitrumUSDT", token: arbitrumUSDT },
  { name: "arbitrumDAI", token: arbitrumDAI },
  { name: "baseETH", token: baseETH },
  { name: "baseUSDC", token: baseUSDC },
  { name: "baseEURC", token: baseEURC },
  { name: "bscBNB", token: bscBNB },
  { name: "ethereumETH", token: ethereumETH },
  { name: "lineaETH", token: lineaETH },
  { name: "mantleMNT", token: mantleMNT },
  { name: "optimismETH", token: optimismETH },
  { name: "polygonPOL", token: polygonPOL },
  { name: "solanaSOL", token: solanaSOL },
  { name: "solanaWSOL", token: solanaWSOL },
  { name: "solanaUSDC", token: solanaUSDC },
  { name: "solanaUSDT", token: solanaUSDT },
  { name: "stellarXLM", token: stellarXLM },
  { name: "stellarUSDC", token: stellarUSDC },
  { name: "worldchainETH", token: worldchainETH },
  { name: "worldchainUSDC", token: worldchainUSDC },
  { name: "gnosisXDAI", token: gnosisXDAI },
  { name: "avalancheAVAX", token: avalancheAVAX },
  { name: "rozoSolanaUSDC", token: rozoSolanaUSDC },
  { name: "rozoSolanaUSDT", token: rozoSolanaUSDT },
  { name: "rozoStellarUSDC", token: rozoStellarUSDC },
  { name: "rozoStellarEURC", token: rozoStellarEURC },
];

function tokenAddrEq(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function findTokenConst(chainId: number, tokenAddr: string): string | null {
  const match = KNOWN_TOKENS.find(
    (t) => t.token.chainId === chainId && tokenAddrEq(t.token.token, tokenAddr),
  );
  return match ? match.name : null;
}

function isEvm(chainId: number): boolean {
  return getChainById(chainId)?.type === "evm";
}

/** Returns JS expression for a chain ID in generated code */
function chainExpr(chainId: number): string {
  const name = CHAIN_CONST[chainId];
  return name ? `${name}.chainId` : `${chainId}`;
}

/** Returns JS expression for a token address in generated code */
function tokExpr(tokenAddr: string, chainId: number): string {
  const name = findTokenConst(chainId, tokenAddr);
  if (name) return `${name}.token`;
  return isEvm(chainId) ? `getAddress("${tokenAddr}")` : `"${tokenAddr}"`;
}

/** Returns JS expression for a destination address in generated code */
function addrExpr(address: string, chainId: number): string {
  return isEvm(chainId) ? `getAddress("${address}")` : `"${address}"`;
}

/** Collect intent-common imports needed for given chainId + tokenAddr */
function buildCommonImports(
  chainId: number,
  tokenAddr: string,
  extraSymbols: string[] = [],
): string {
  const symbols: string[] = [...extraSymbols];

  const chainName = CHAIN_CONST[chainId];
  if (chainName) symbols.push(chainName);

  const tokName = findTokenConst(chainId, tokenAddr);
  if (tokName) symbols.push(tokName);

  if (symbols.length === 0) return "";
  return `import { ${symbols.join(", ")} } from "@rozoai/intent-common";\n`;
}

function viemImport(chainId: number, tokenAddr: string): string {
  const tokName = findTokenConst(chainId, tokenAddr);
  // Only need getAddress if token isn't a named constant and chain is EVM
  if (!tokName && isEvm(chainId)) return `import { getAddress } from "viem";\n`;
  // Still need getAddress for the destination address on EVM
  if (isEvm(chainId)) return `import { getAddress } from "viem";\n`;
  return "";
}

export function generateBridgeSnippet(config: BridgeConfig): string {
  const addr = addrExpr(config.toAddress, config.toChain);
  const tok = tokExpr(config.toToken, config.toChain);
  const chain = chainExpr(config.toChain);

  const knownToken = getKnownToken(config.toChain, config.toToken);
  const isEURC = knownToken ? knownToken.symbol === TokenSymbol.EURC : false;
  const preferredSymbolProp = isEURC ? "\n      preferredSymbol={[TokenSymbol.EURC]}" : "";
  const tokenSymbolImport = isEURC ? ", TokenSymbol" : "";

  const commonImport = buildCommonImports(config.toChain, config.toToken);
  const viem = viemImport(config.toChain, config.toToken);

  return `${viem}${commonImport}import { RozoPayButton, useRozoPayUI${tokenSymbolImport} } from "@rozoai/intent-pay";
import { useEffect, useState } from "react";

const APP_ID = "${APP_ID}";

export default function BridgePayment() {
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    resetPayment({
      toChain: ${chain},
      toToken: ${tok},
      toAddress: ${addr},
      toUnits: "${config.toUnits}",
    }).then(() => setReady(true));
  }, [resetPayment]);

  return (
    <RozoPayButton.Custom
      appId={APP_ID}
      toChain={${chain}}
      toToken={${tok}}
      toAddress={${addr}}
      toUnits="${config.toUnits}"${preferredSymbolProp}
      intent="Bridge"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => (
        <button onClick={show} disabled={!ready}>
          Pay Now
        </button>
      )}
    </RozoPayButton.Custom>
  );
}`;
}

export function generateCheckoutSnippet(config: CheckoutConfig): string {
  const addr = addrExpr(config.toAddress, config.toChain);
  const tok = tokExpr(config.toToken, config.toChain);
  const chain = chainExpr(config.toChain);

  const knownToken = getKnownToken(config.toChain, config.toToken);
  const isEURC = knownToken ? knownToken.symbol === TokenSymbol.EURC : false;
  const preferredSymbolProp = isEURC ? "\n      preferredSymbol={[TokenSymbol.EURC]}" : "";
  const tokenSymbolImport = isEURC ? ", TokenSymbol" : "";

  const commonImport = buildCommonImports(config.toChain, config.toToken);
  const viem = viemImport(config.toChain, config.toToken);

  return `${viem}${commonImport}import { RozoPayButton${tokenSymbolImport} } from "@rozoai/intent-pay";
import { createPayment } from "@rozoai/intent-common";
import { useState } from "react";

const APP_ID = "${APP_ID}";

export default function OnlineCheckout() {
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreatePayment() {
    setLoading(true);
    setPaymentId(null);
    try {
      const result = await createPayment({
        appId: APP_ID,
        toChain: ${chain},
        toToken: ${tok},
        toAddress: ${addr},
        toUnits: "${config.toUnits}",
        preferredChain: ${chain},
        preferredTokenAddress: ${tok},
      });
      setPaymentId(result.id);
    } finally {
      setLoading(false);
    }
  }

  if (!paymentId) {
    return (
      <button onClick={handleCreatePayment} disabled={loading}>
        {loading ? "Creating..." : "Create Payment"}
      </button>
    );
  }

  return (
    <RozoPayButton.Custom
      key={paymentId}
      payId={paymentId}${preferredSymbolProp}
      intent="Checkout"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => <button onClick={show}>Pay Now</button>}
    </RozoPayButton.Custom>
  );
}`;
}

export function generateDepositSnippet(config: DepositConfig): string {
  const addr = addrExpr(config.toAddress, config.toChain);
  const tok = tokExpr(config.toToken, config.toChain);
  const chain = chainExpr(config.toChain);

  const knownToken = getKnownToken(config.toChain, config.toToken);
  const isEURC = knownToken ? knownToken.symbol === TokenSymbol.EURC : false;
  const preferredSymbolProp = isEURC ? "\n      preferredSymbol={[TokenSymbol.EURC]}" : "";
  const tokenSymbolImport = isEURC ? ", TokenSymbol" : "";

  const commonImport = buildCommonImports(config.toChain, config.toToken);
  const viem = viemImport(config.toChain, config.toToken);

  return `${viem}${commonImport}import { RozoPayButton, useRozoPayUI${tokenSymbolImport} } from "@rozoai/intent-pay";
import { useEffect, useState } from "react";

const APP_ID = "${APP_ID}";

export default function WalletDeposit() {
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    resetPayment({
      toChain: ${chain},
      toToken: ${tok},
      toAddress: ${addr},
      // No toUnits — user enters amount inside the modal
    }).then(() => setReady(true));
  }, [resetPayment]);

  return (
    <RozoPayButton.Custom
      appId={APP_ID}
      toChain={${chain}}
      toToken={${tok}}
      toAddress={${addr}}${preferredSymbolProp}
      intent="Deposit"
      onPaymentStarted={(e) => console.log("started", e)}
      onPaymentCompleted={(e) => console.log("completed", e)}
      onPayoutCompleted={(e) => console.log("payout", e)}
    >
      {({ show }) => (
        <button onClick={show} disabled={!ready}>
          Deposit
        </button>
      )}
    </RozoPayButton.Custom>
  );
}`;
}
