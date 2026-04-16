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
    : `${tokenVarName}.token`;

  const importStatement = isEvm
    ? `import { getAddress } from "viem";\nimport { ${tokenVarName}, TokenSymbol } from "@rozoai/intent-common";`
    : `import { ${tokenVarName}, TokenSymbol } from "@rozoai/intent-common";`;

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
    try {
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
    } catch {
      // Ignore malformed saved config and fall back to defaults.
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
    if (!config.chainId || !config.tokenAddress || !config.recipientAddress) {
      setEurcValidationError(
        "Configure the payment destination before changing preferred currency.",
      );
      setIsConfigOpen(true);
      return;
    }

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
    <Container className="mx-auto w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary-medium">
          Basic Demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">
          Configure a payment and inspect the exact integration output
        </h1>
        <Text className="max-w-2xl text-base leading-7 text-gray-600">
          This example is optimized for developer testing: configure the payout
          destination, run the payment flow, and copy the generated
          implementation snippet.
        </Text>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Payment options</p>
          <Text className="text-sm text-gray-600">
            Toggle preferred currency and adjust the destination config without
            leaving the page.
          </Text>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={handleChangeCurrency}
            className="min-h-11 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            Change currency
          </button>
          <button
            onClick={() => setIsConfigOpen(true)}
            className="min-h-11 rounded-xl bg-primary-dark px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-medium"
          >
            {hasValidConfig ? "Edit configuration" : "Configure payment"}
          </button>
        </div>
      </div>

      {eurcValidationError && (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4"
        >
          <p className="text-sm leading-6 text-red-800">{eurcValidationError}</p>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Payment runner
                </h2>
                <Text className="text-sm leading-6 text-gray-600">
                  Launch the Rozo Pay flow using the current destination
                  settings.
                </Text>
              </div>

              {Boolean(hasValidConfig) && parsedConfig ? (
                <>
                  <div className="grid gap-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Chain
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {getChainName(parsedConfig.chainId)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Amount
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900">
                        {parsedConfig.amount}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Recipient
                      </p>
                      <p className="mt-1 break-all text-sm text-gray-700">
                        {parsedConfig.recipientAddress}
                      </p>
                    </div>
                  </div>

                  {isDestinationEURC && (
                    <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                      <p className="text-sm leading-6 text-yellow-900">
                        <strong>EURC restriction:</strong> EURC can only be sent
                        to another EURC token.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
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
                          className="min-h-12 flex-1 rounded-xl bg-primary-dark px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-medium"
                        >
                          Make Payment
                        </button>
                      )}
                    </RozoPayButton.Custom>
                    <button
                      onClick={() => setIsConfigOpen(true)}
                      className="min-h-12 rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                    >
                      Edit Configuration
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6">
                  <h3 className="text-base font-semibold text-gray-900">
                    Get started
                  </h3>
                  <Text className="mt-2 text-sm leading-6 text-gray-600">
                    Set the receiving chain, token, address, and amount to
                    enable the payment flow and generated code output.
                  </Text>
                </div>
              )}
            </div>
          </section>

          {Boolean(hasValidConfig) && codeSnippet && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-5 space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Implementation code
                </h2>
                <Text className="text-sm leading-6 text-gray-600">
                  Copy this snippet to reproduce the current payment
                  configuration in your own app.
                </Text>
              </div>
              <CodeSnippetDisplay code={codeSnippet} />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <ConnectStellarWallet />

          {(parsedConfig && isStellarChain(parsedConfig.chainId)) ||
          (parsedConfig && isSolanaChain(parsedConfig.chainId)) ? (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              {parsedConfig && isStellarChain(parsedConfig.chainId) && (
                <>
                  <h3 className="text-base font-semibold text-blue-900">
                    Stellar notes
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-blue-950">
                    <li>
                      <code className="rounded bg-blue-100 px-1.5 py-0.5">
                        toChain
                      </code>{" "}
                      uses <strong>{rozoStellar.chainId}</strong>.
                    </li>
                    <li>
                      <code className="rounded bg-blue-100 px-1.5 py-0.5">
                        toAddress
                      </code>{" "}
                      must be a valid Stellar address.
                    </li>
                    <li>
                      <code className="rounded bg-blue-100 px-1.5 py-0.5">
                        toToken
                      </code>{" "}
                      must be the supported Stellar asset code.
                    </li>
                  </ul>
                </>
              )}

              {parsedConfig && isSolanaChain(parsedConfig.chainId) && (
                <>
                  <h3 className="text-base font-semibold text-blue-900">
                    Solana notes
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-blue-950">
                    <li>
                      <code className="rounded bg-blue-100 px-1.5 py-0.5">
                        toChain
                      </code>{" "}
                      uses <strong>{rozoSolana.chainId}</strong>.
                    </li>
                    <li>
                      <code className="rounded bg-blue-100 px-1.5 py-0.5">
                        toAddress
                      </code>{" "}
                      must be a valid Solana address.
                    </li>
                    <li>
                      <code className="rounded bg-blue-100 px-1.5 py-0.5">
                        toToken
                      </code>{" "}
                      must be the supported mint address.
                    </li>
                  </ul>
                </>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">
              Key props
            </h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="font-mono font-semibold text-gray-900">appId</dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  Your application identifier for RozoAI Intent Pay.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-gray-900">
                  toChain
                </dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  The destination blockchain network ID.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-gray-900">
                  toToken
                </dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  The token contract address or chain-specific token identifier.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-gray-900">
                  toAddress
                </dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  The recipient wallet address.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-gray-900">
                  preferredSymbol
                </dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  Prioritizes symbols like USDC, USDT, or EURC in the token list.
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <ConfigPanel
        configType="payment"
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfirm={(config) => handleSetConfig(config as Config)}
        defaultRecipientAddress={config.recipientAddress}
      />
    </Container>
  );
}
