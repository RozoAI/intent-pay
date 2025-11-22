"use client";

import * as Tokens from "@rozoai/intent-common";
import {
  baseUSDC,
  getChainName,
  getChainNativeToken,
  knownTokens,
  worldchain,
} from "@rozoai/intent-common";
import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Address, getAddress, isAddress } from "viem";
import { Text } from "../../shared/tailwind-catalyst/text";
import { ConfigPanel } from "../config-panel";
import { APP_ID, Container, usePersistedConfig } from "../shared";

type Config = {
  recipientAddress: string;
  recipientStellarAddress?: string;
  recipientSolanaAddress?: string;
  chainId: number;
  tokenAddress: string;
  amount: string;
};

const tempAddress = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Generates TypeScript code snippet for implementing RozoPayButton
 */
const generateCodeSnippet = (config: Config): string => {
  // Check if it's a native token
  const isNativeToken =
    config.tokenAddress === getChainNativeToken(config.chainId)?.token;

  if (isNativeToken) {
    const nativeToken = getChainNativeToken(config.chainId);
    const tokenVarName = nativeToken
      ? getChainName(config.chainId).toLowerCase() + nativeToken.symbol
      : "";

    return `import { getAddress } from "viem";
import { ${tokenVarName} } from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";

export default function YourComponent() {
  return (
    <RozoPayButton
      appId="${APP_ID}"
      toChain={${tokenVarName}.chainId}
      toAddress={getAddress("${config.recipientAddress}")}${
      config.recipientStellarAddress
        ? `\n      toStellarAddress="${config.recipientStellarAddress}"`
        : ""
    }
      toUnits="${config.amount}"
      toToken={getAddress(${tokenVarName}.token)}
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
    (t: any) => t.token === config.tokenAddress && t.chainId === config.chainId
  );

  if (!token) return "";

  const tokenVarName =
    Object.entries(Tokens).find(([_, t]) => t === token)?.[0] || token.symbol;

  return `import { getAddress } from "viem";
import { ${tokenVarName} } from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";

export default function YourComponent() {
  return (
    <RozoPayButton
      appId="${APP_ID}"
      toChain={${tokenVarName}.chainId}
      toAddress={getAddress("${config.recipientAddress}")}${
    config.recipientStellarAddress
      ? `\n      toStellarAddress="${config.recipientStellarAddress}"`
      : ""
  }
      toUnits="${config.amount}"
      toToken={getAddress(${tokenVarName}.token)}
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

export default function DemoBasic() {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = usePersistedConfig("rozo-basic-config", {
    recipientAddress: "",
    recipientStellarAddress: "",
    recipientSolanaAddress: "",
    chainId: 0,
    tokenAddress: "",
    amount: "",
  } as Config);
  const [parsedConfig, setParsedConfig] = useState<Config | null>(null);
  const { resetPayment } = useRozoPayUI();

  const handleSetConfig = useCallback(
    (newConfig: Config) => {
      setConfig(newConfig);
      setParsedConfig(newConfig);

      // NOTE: This is used to reset the payment state when the config changes
      resetPayment({
        toChain: newConfig.chainId,
        toAddress: getAddress(newConfig.recipientAddress),
        toStellarAddress: newConfig.recipientStellarAddress,
        toUnits: newConfig.amount,
        toToken: getAddress(newConfig.tokenAddress),
      });
    },
    [setConfig, resetPayment]
  );

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
      localStorage.getItem("rozo-basic-config") || "{}"
    );

    if (getConfig && getConfig.chainId !== 0) {
      const parsedConfig = { ...getConfig };

      if (!isAddress(parsedConfig.tokenAddress)) {
        Object.assign(parsedConfig, {
          tokenAddress: tempAddress,
        });
      }

      if (!isAddress(parsedConfig.recipientAddress)) {
        Object.assign(parsedConfig, {
          recipientAddress: tempAddress,
        });
      }

      if (
        parsedConfig &&
        typeof parsedConfig === "object" &&
        "recipientAddress" in parsedConfig &&
        "chainId" in parsedConfig &&
        "tokenAddress" in parsedConfig
      ) {
        setConfig(parsedConfig);
        setParsedConfig(parsedConfig);
      }
    }
  }, []);

  // Check if we have valid configuration
  const hasValidConfig =
    parsedConfig &&
    parsedConfig.recipientAddress &&
    parsedConfig.chainId &&
    parsedConfig.tokenAddress &&
    parsedConfig.amount;

  // Generate code snippet when config changes
  const codeSnippet = useMemo(() => {
    if (!hasValidConfig || !parsedConfig) return "";
    return generateCodeSnippet(parsedConfig);
  }, [hasValidConfig, parsedConfig]);

  const metadata = useMemo(
    () => ({
      orderDate: new Date().toISOString(),
    }),
    []
  );

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

      {/* Main Content */}
      <div className="flex flex-col items-center gap-6">
        {/* Payment Button Section */}
        {Boolean(hasValidConfig) && parsedConfig ? (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="bg-white rounded-lg shadow-md p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Try the Payment
              </h2>
              <div className="flex flex-col gap-3">
                <RozoPayButton.Custom
                  appId={APP_ID}
                  toChain={parsedConfig.chainId}
                  toAddress={getAddress(parsedConfig.recipientAddress)}
                  toStellarAddress={parsedConfig.recipientStellarAddress}
                  toUnits={parsedConfig.amount}
                  toToken={getAddress(parsedConfig.tokenAddress)}
                  preferredChains={[worldchain.chainId]}
                  onPaymentStarted={(e) => {
                    console.log("✓ Payment started:", e);
                  }}
                  onPaymentCompleted={(e) => {
                    console.log("✓ Payment completed:", e);
                  }}
                  onPayoutCompleted={(e: any) => {
                    console.log("✓ Payout completed:", e);
                  }}
                  resetOnSuccess={true}
                  metadata={metadata}
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
                    toAddress
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    The recipient's wallet address
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
                    toUnits
                  </dt>
                  <dd className="text-gray-700 ml-4">
                    Amount in token's smallest unit (e.g., wei for ETH)
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

        {/* Cross-chain Payment Note */}
        {parsedConfig?.recipientStellarAddress && (
          <div className="w-full bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              ⚠️ Cross-Chain Payment Configuration
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              When bridging to Stellar networks:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>
                Set <code className="bg-yellow-100 px-1 rounded">toChain</code>{" "}
                to Base Chain ID: <strong>{baseUSDC.chainId}</strong>
              </li>
              <li>
                Set <code className="bg-yellow-100 px-1 rounded">toToken</code>{" "}
                to Base USDC: <strong>{baseUSDC.token}</strong>
              </li>
              <li>
                The{" "}
                <code className="bg-yellow-100 px-1 rounded">toAddress</code>{" "}
                can be any valid EVM address. In here we are using{" "}
                <code className="bg-yellow-100 px-1 rounded">
                  {tempAddress}
                </code>
              </li>
              <li>
                Use{" "}
                <code className="bg-yellow-100 px-1 rounded">
                  toStellarAddress
                </code>{" "}
                for the final destination
              </li>
            </ul>
          </div>
        )}

        {/* Config Panel Modal */}
        <ConfigPanel
          configType="payment"
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          onConfirm={handleSetConfig}
          defaultRecipientAddress={config.recipientAddress}
        />
      </div>
    </Container>
  );
}
