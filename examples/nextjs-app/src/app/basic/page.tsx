"use client";

import * as Tokens from "@rozoai/intent-common";
import {
  baseEURC,
  FeeType,
  getChainById,
  getChainName,
  getChainNativeToken,
  getKnownToken,
  knownTokens,
  rozoSolana,
  rozoStellar,
  rozoStellarEURC,
  TokenSymbol,
} from "@rozoai/intent-common";
import {
  RozoPayButton,
  useRozoConnectStellar,
  useRozoPayUI,
} from "@rozoai/intent-pay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getAddress } from "viem";
import { Text } from "../../shared/tailwind-catalyst/text";
import { ConfigPanel } from "../config-panel";
import { APP_ID, Container, usePersistedConfig } from "../shared";

type Config = {
  recipientAddress: string; // Unified: EVM Address or Solana/Stellar string
  chainId: number; // Destination chain ID
  tokenAddress: string;
  amount: string;
  preferredSymbol: TokenSymbol[];
};

/**
 * Generates TypeScript code snippet for implementing RozoPayButton
 */
const generateCodeSnippet = (config: Config): string => {
  const chain = getChainById(config.chainId);

  if (!chain) return "";

  const isEvm = chain.type === "evm";
  const isSolana = chain.type === "solana";

  // For EVM chains, use getAddress helper
  // For non-EVM chains, use string directly
  const addressCode = isEvm
    ? `getAddress("${config.recipientAddress}")`
    : `"${config.recipientAddress}"`;

  // Check if it's a native token
  const isNativeToken =
    config.tokenAddress === getChainNativeToken(config.chainId)?.token;

  if (isNativeToken) {
    const nativeToken = getChainNativeToken(config.chainId);
    const tokenVarName = nativeToken
      ? getChainName(config.chainId).toLowerCase() + nativeToken.symbol
      : "";

    const tokenCode = isEvm
      ? `getAddress(${tokenVarName}.token)`
      : `${tokenVarName}.token`;

    const importStatement = isEvm
      ? `import { getAddress } from "viem";\nimport { ${tokenVarName} } from "@rozoai/intent-common";`
      : `import { ${tokenVarName} } from "@rozoai/intent-common";`;

    return `${importStatement}
import { RozoPayButton } from "@rozoai/intent-pay";

export default function YourComponent() {
  return (
    <RozoPayButton
      appId="${APP_ID}"
      toChain={${tokenVarName}.chainId}
      toAddress={${addressCode}}
      toUnits="${config.amount}"
      toToken={${tokenCode}}
      onPaymentStarted={(event) => {
        console.log("Payment started:", event);
      }}
      onPaymentCompleted={(event) => {
        console.log("Payment completed:", event);
      }}
    />
  );
}`;
  }

  // For non-native tokens
  const token = knownTokens.find(
    (t: any) => t.token === config.tokenAddress && t.chainId === config.chainId,
  );

  if (!token) return "";

  const tokenVarName =
    Object.entries(Tokens).find(([_, t]) => t === token)?.[0] || token.symbol;

  const tokenCode = isEvm
    ? `getAddress(${tokenVarName}.token)`
    : isSolana
      ? `rozoSolanaUSDC.token`
      : `rozoStellarUSDC.token`;

  const importStatement = isEvm
    ? `import { getAddress } from "viem";\nimport { ${tokenVarName} } from "@rozoai/intent-common";`
    : isSolana
      ? `import { rozoSolanaUSDC } from "@rozoai/intent-common";`
      : `import { rozoStellarUSDC } from "@rozoai/intent-common";`;

  return `${importStatement}
import { RozoPayButton } from "@rozoai/intent-pay";

export default function YourComponent() {
  return (
    <RozoPayButton
      appId="${APP_ID}"
      toChain={${tokenVarName}.chainId}
      toToken={${tokenCode}}
      toAddress={${addressCode}}
      toUnits="${config.amount}"
      preferredSymbol={[${config.preferredSymbol
        .map((s: TokenSymbol) => `TokenSymbol.${s}`)
        .join(", ")}]}
      onPaymentStarted={(event) => {
        console.log("Payment started:", event);
      }}
      onPaymentCompleted={(event) => {
        console.log("Payment completed:", event);
      }}
    />
  );
}`;
};

/**
 * Code Snippet Component with Copy Button
 */
const CodeSnippetDisplay = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="relative rounded-lg overflow-hidden border border-primary-medium">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-md 
                   bg-gray-800 hover:bg-gray-700 transition-colors
                   text-white text-sm font-medium"
        title="Copy code"
      >
        {copied ? "✓ Copied!" : "Copy"}
      </button>
      <SyntaxHighlighter
        language="typescript"
        style={vscDarkPlus}
        customStyle={{
          margin: 0,
          padding: "1.5rem",
          fontSize: "0.875rem",
          lineHeight: "1.5",
        }}
        showLineNumbers
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

/**
 * Simple Connect Stellar Wallet Component
 */
const ConnectStellarWallet = () => {
  const {
    kit,
    isConnected,
    publicKey,
    connector,
    setConnector,
    disconnect,
    setPublicKey,
  } = useRozoConnectStellar();
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showWallets, setShowWallets] = useState(false);

  // Fetch available wallets
  useEffect(() => {
    const fetchWallets = async () => {
      if (!kit) return;
      setIsLoading(true);
      try {
        const availableWallets = await kit.getSupportedWallets();
        setWallets(availableWallets.filter((w: any) => w.isAvailable));
      } catch (error) {
        console.error("Error fetching Stellar wallets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWallets();
  }, [kit]);

  const handleConnect = async (wallet: any) => {
    try {
      if (!kit) return;
      // Use SDK's setWallet (setConnector) so connection is idempotent and avoids double WalletConnect confirmation
      await setConnector(wallet);
      setShowWallets(false);
    } catch (error) {
      console.error("Error connecting wallet:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
    }
  };

  if (isConnected && publicKey) {
    return (
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Stellar Wallet Connected
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Wallet:</span>
            <span className="text-sm text-gray-800">
              {connector?.name || "Unknown"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Address:</span>
            <span className="text-sm text-gray-800 font-mono break-all">
              {publicKey}
            </span>
          </div>
          <button
            onClick={handleDisconnect}
            className="w-full mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Connect Stellar Wallet
      </h3>
      {isLoading ? (
        <p className="text-sm text-gray-600">Loading wallets...</p>
      ) : (
        <>
          {!showWallets ? (
            <button
              onClick={() => setShowWallets(true)}
              className="w-full px-4 py-2 bg-primary-dark text-white rounded-lg hover:bg-primary-medium transition-colors font-medium"
            >
              Connect Wallet
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => setShowWallets(false)}
                className="mb-2 text-sm text-gray-600 hover:text-gray-800"
              >
                ← Back
              </button>
              {wallets.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No Stellar wallets detected. Please install a Stellar wallet
                  extension.
                </p>
              ) : (
                <div className="space-y-2">
                  {wallets.map((wallet) => (
                    <button
                      key={wallet.id}
                      onClick={() => handleConnect(wallet)}
                      className="w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-3"
                    >
                      {wallet.icon && (
                        <img
                          src={wallet.icon}
                          alt={wallet.name}
                          className="w-6 h-6"
                        />
                      )}
                      <span className="text-sm font-medium text-gray-800">
                        {wallet.name}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default function DemoBasic() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = usePersistedConfig("rozo-basic-config", {
    recipientAddress: "",
    chainId: 8453,
    tokenAddress: "",
    amount: "",
  } as Config);
  const [parsedConfig, setParsedConfig] = useState<Config | null>(null);
  const { resetPayment } = useRozoPayUI();
  const [preferredSymbol, setPreferredSymbol] = useState<TokenSymbol[]>([
    TokenSymbol.USDC,
    TokenSymbol.USDT,
  ]);
  const [eurcValidationError, setEurcValidationError] = useState<string>("");

  const handleSetConfig = useCallback(
    (newConfig: Config, symbols?: TokenSymbol[]) => {
      const symbolsToUse = symbols ?? preferredSymbol;

      // Validate EURC: EURC can only be sent to EURC
      const hasEURC = symbolsToUse.includes(TokenSymbol.EURC);
      if (hasEURC && newConfig.tokenAddress) {
        const destinationToken = getKnownToken(
          newConfig.chainId,
          newConfig.tokenAddress,
        );
        const isDestinationEURC = destinationToken?.symbol === TokenSymbol.EURC;

        if (!isDestinationEURC) {
          setEurcValidationError(
            `EURC can only be sent to another EURC. Please select an EURC token as the destination token.`,
          );
          return; // Don't update config if validation fails
        }
      }

      // Clear error if validation passes
      setEurcValidationError("");

      const configWithSymbols = {
        ...newConfig,
        preferredSymbol: symbolsToUse,
      };
      setConfig(configWithSymbols);
      setParsedConfig(configWithSymbols);

      // NOTE: This is used to reset the payment state when the config changes
      const chain = getChainById(newConfig.chainId);
      if (!chain) return;
      const isEvm = chain.type === "evm";
      const payParams: any = {
        toChain: newConfig.chainId,
        toUnits: newConfig.amount,
      };

      if (isEvm) {
        payParams.toAddress = getAddress(newConfig.recipientAddress);
        payParams.toToken = getAddress(newConfig.tokenAddress);
      } else {
        payParams.toAddress = newConfig.recipientAddress;
        payParams.toToken = newConfig.tokenAddress;
      }

      const params = {
        ...payParams,
        preferredSymbol: symbolsToUse,
      };
      console.log("params", params);
      resetPayment(params);
    },
    [setConfig, resetPayment, preferredSymbol],
  );

  const isSolanaChain = useCallback((chainId: number) => {
    const chain = getChainById(chainId);
    return chain?.type === "solana";
  }, []);

  const isStellarChain = useCallback((chainId: number) => {
    const chain = getChainById(chainId);
    return chain?.type === "stellar";
  }, []);

  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isConfigOpen) {
        setIsConfigOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isConfigOpen]);

  useEffect(() => {
    const getConfig = JSON.parse(
      localStorage.getItem("rozo-basic-config") || "{}",
    );

    if (getConfig && getConfig.chainId !== 0) {
      const parsedConfig: Config = {
        recipientAddress: getConfig.recipientAddress || "",
        chainId: getConfig.chainId || 0,
        tokenAddress: getConfig.tokenAddress || "",
        amount: getConfig.amount || "",
        preferredSymbol: getConfig.preferredSymbol || [
          TokenSymbol.USDC,
          TokenSymbol.USDT,
        ],
      };

      // Validate and clean up config
      if (
        parsedConfig &&
        typeof parsedConfig === "object" &&
        "recipientAddress" in parsedConfig &&
        "chainId" in parsedConfig &&
        "tokenAddress" in parsedConfig
      ) {
        // Validate EURC: EURC can only be sent to EURC
        const hasEURC = parsedConfig.preferredSymbol?.includes(
          TokenSymbol.EURC,
        );
        if (hasEURC && parsedConfig.tokenAddress && parsedConfig.chainId) {
          const destinationToken = getKnownToken(
            parsedConfig.chainId,
            parsedConfig.tokenAddress,
          );
          const isDestinationEURC =
            destinationToken?.symbol === TokenSymbol.EURC;

          if (!isDestinationEURC) {
            // Reset preferredSymbol to default if EURC validation fails
            parsedConfig.preferredSymbol = [TokenSymbol.USDC, TokenSymbol.USDT];
            setEurcValidationError(
              `EURC can only be sent to another EURC. Configuration has been reset to default.`,
            );
          }
        }

        setConfig(parsedConfig);
        setParsedConfig(parsedConfig);
        if (parsedConfig.preferredSymbol) {
          setPreferredSymbol(parsedConfig.preferredSymbol);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if we have valid configuration
  const hasValidConfig =
    parsedConfig &&
    parsedConfig.recipientAddress &&
    parsedConfig.chainId &&
    parsedConfig.tokenAddress &&
    parsedConfig.amount;

  // Check if destination token is Base EURC or Stellar EURC
  const isDestinationEURC = useMemo(() => {
    if (!parsedConfig || !parsedConfig.tokenAddress || !parsedConfig.chainId) {
      return false;
    }

    const chain = getChainById(parsedConfig.chainId);
    if (!chain) return false;
    const isEvm = chain.type === "evm";

    const destinationToken = getKnownToken(
      parsedConfig.chainId,
      parsedConfig.tokenAddress,
    );

    if (!destinationToken) return false;

    // Check if it's Base EURC
    if (parsedConfig.chainId === baseEURC.chainId && isEvm) {
      try {
        return (
          getAddress(destinationToken.token) === getAddress(baseEURC.token)
        );
      } catch {
        return destinationToken.token === baseEURC.token;
      }
    }

    // Check if it's Stellar EURC
    if (parsedConfig.chainId === rozoStellarEURC.chainId) {
      return destinationToken.token === rozoStellarEURC.token;
    }

    return false;
  }, [parsedConfig]);

  // Generate code snippet when config changes
  const codeSnippet = useMemo(() => {
    if (!hasValidConfig || !parsedConfig) return "";
    return generateCodeSnippet(parsedConfig);
  }, [hasValidConfig, parsedConfig]);

  const metadata = useMemo(
    () => ({
      orderDate: new Date().toISOString(),
    }),
    [],
  );

  // Toggle between [USDC, USDT] and [EURC]
  const handleChangeCurrency = useCallback(() => {
    const nextSymbols =
      preferredSymbol.length === 1 && preferredSymbol[0] === TokenSymbol.EURC
        ? [TokenSymbol.USDC, TokenSymbol.USDT]
        : [TokenSymbol.EURC];

    // If switching to EURC, find and set an EURC token for the current chain
    if (nextSymbols.includes(TokenSymbol.EURC) && config.chainId) {
      const eurcToken = knownTokens.find(
        (t: any) =>
          t.chainId === config.chainId && t.symbol === TokenSymbol.EURC,
      );

      if (eurcToken) {
        const updatedConfig: Config = {
          ...config,
          tokenAddress: eurcToken.token,
          preferredSymbol: nextSymbols,
        };
        setPreferredSymbol(nextSymbols);
        handleSetConfig(updatedConfig, nextSymbols);
        return;
      } else {
        setEurcValidationError(
          `EURC is not available on the selected chain. Please select a chain that supports EURC (Base, Ethereum, or Stellar).`,
        );
        return;
      }
    }

    setPreferredSymbol(nextSymbols);
    handleSetConfig(config, nextSymbols);
  }, [config, preferredSymbol, handleSetConfig]);

  return (
    <Container className="max-w-4xl mx-auto p-6">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-primary-dark mb-4">
          Basic Payment Demo
        </h1>
        <Text className="text-lg text-gray-700">
          This demo shows how to accept payments from any coin on any chain
          using the RozoAI Intent Pay SDK. Configure the payment details below
          to get started.
        </Text>
      </div>

      <div className="mb-4 flex items-center gap-4">
        <button
          onClick={handleChangeCurrency}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium mx-auto"
        >
          Change currency
        </button>
        {eurcValidationError && (
          <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{eurcValidationError}</p>
          </div>
        )}
      </div>

      {/* Connect Stellar Wallet Section */}
      <ConnectStellarWallet />

      {/* Main Content */}
      <div className="flex flex-col items-center gap-6">
        {/* Payment Button Section */}
        {Boolean(hasValidConfig) && parsedConfig ? (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Try the Payment
              </h2>
              {isDestinationEURC && (
                <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>⚠️ EURC Restriction:</strong> EURC can only be sent
                    to another EURC token. The destination token must be EURC.
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-3">
                <RozoPayButton.Custom
                  appId={APP_ID}
                  toChain={parsedConfig.chainId}
                  toAddress={parsedConfig.recipientAddress}
                  toToken={parsedConfig.tokenAddress}
                  toUnits={parsedConfig.amount}
                  onPaymentStarted={(e) => {
                    console.log("✓ Payment started:", e);
                  }}
                  onPaymentCompleted={(e) => {
                    console.log("✓ Payment completed:", e);
                  }}
                  onPayoutCompleted={(e: any) => {
                    console.log("✓ Payout completed:", e);
                  }}
                  feeType={FeeType.ExactOut}
                  preferredSymbol={preferredSymbol}
                  metadata={metadata}
                  resetOnSuccess
                  showProcessingPayout
                >
                  {(renderProps) => (
                    <button
                      onClick={renderProps.show}
                      className="w-full bg-primary-dark text-white px-6 py-3 rounded-lg hover:bg-primary-medium transition-all font-medium"
                    >
                      Make Payment
                    </button>
                  )}
                </RozoPayButton.Custom>
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="w-full border-2 border-primary-dark text-primary-dark px-6 py-3 rounded-lg hover:bg-primary-dark hover:text-white transition-all font-medium"
                >
                  Edit Configuration
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-md text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Get Started
            </h2>
            <p className="text-gray-600 mb-6">
              Configure your payment settings to see a live demo and get the
              implementation code.
            </p>
            <button
              onClick={() => setIsConfigOpen(true)}
              className="w-full bg-primary-dark text-white px-6 py-3 rounded-lg hover:bg-primary-medium transition-all font-medium"
            >
              Configure Payment Settings
            </button>
          </div>
        )}

        {/* Implementation Code Section */}
        {Boolean(hasValidConfig) && codeSnippet && (
          <div className="w-full mt-8">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-primary-dark mb-2">
                Implementation Code
              </h2>
              <Text className="text-gray-600">
                Copy this code to integrate RozoPayButton into your application:
              </Text>
            </div>
            <CodeSnippetDisplay code={codeSnippet} />

            {/* Chain-specific Payment Notes */}
            {parsedConfig && isStellarChain(parsedConfig.chainId) && (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  ℹ️ Stellar Payment Configuration
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  For Stellar payments:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>
                    <code className="bg-blue-100 px-1 rounded">toChain</code> is
                    set to Stellar Chain ID:{" "}
                    <strong>{rozoStellar.chainId}</strong>
                  </li>
                  <li>
                    <code className="bg-blue-100 px-1 rounded">toAddress</code>{" "}
                    must be a valid Stellar address
                  </li>
                  <li>
                    <code className="bg-blue-100 px-1 rounded">toToken</code> is
                    the asset code (Only Supported USDC Token:
                    GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN)
                  </li>
                </ul>
              </div>
            )}

            {parsedConfig && isSolanaChain(parsedConfig.chainId) && (
              <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  ℹ️ Solana Payment Configuration
                </h3>
                <p className="text-sm text-gray-700 mb-2">
                  For Solana payments:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                  <li>
                    <code className="bg-blue-100 px-1 rounded">toChain</code> is
                    set to Solana Chain ID:{" "}
                    <strong>{rozoSolana.chainId}</strong>
                  </li>
                  <li>
                    <code className="bg-blue-100 px-1 rounded">toAddress</code>{" "}
                    must be a valid Solana address
                  </li>
                  <li>
                    <code className="bg-blue-100 px-1 rounded">toToken</code> is
                    the token mint address (Only Supported USDC Token:
                    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
                  </li>
                </ul>
              </div>
            )}

            {/* API Reference */}
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                📚 Key Props Explained
              </h3>
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    appId
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    Your application identifier for RozoAI Intent Pay
                  </dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    toChain
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    The destination blockchain network ID
                  </dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    toToken
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    The token contract address to receive
                  </dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    toAddress
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    The recipient&apos;s wallet address
                  </dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    toUnits
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    Amount in USD (e.g., 100.00)
                  </dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    preferredSymbol
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    Preferred token symbols (USDC, USDT, EURC). These tokens
                    will appear first in the token selection list. Defaults to{" "}
                    <code className="bg-blue-100 px-1 rounded">
                      [USDC, USDT]
                    </code>
                    . Automatically finds matching tokens across all supported
                    chains.
                    <br />
                    <strong className="text-red-600">
                      ⚠️ Important: EURC can only be sent to another EURC token.
                      If EURC is in preferredSymbol, the destination token must
                      also be EURC.
                    </strong>
                  </dd>
                </div>
                <div>
                  <dt className="font-mono font-semibold text-blue-800">
                    onPaymentStarted / onPaymentCompleted
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    Event callbacks to track payment lifecycle
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Config Panel Modal */}
        <ConfigPanel
          configType="payment"
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          onConfirm={(config) => handleSetConfig(config as Config)}
          defaultRecipientAddress={config.recipientAddress}
        />
      </div>
    </Container>
  );
}
