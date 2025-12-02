"use client";

import * as Tokens from "@rozoai/intent-common";
import {
  getChainName,
  getChainNativeToken,
  knownTokens,
  rozoSolana,
  rozoStellar,
} from "@rozoai/intent-common";
import {
  isEvmChain,
  isSolanaChain,
  isStellarChain,
  RozoPayButton,
  useRozoPayUI,
} from "@rozoai/intent-pay";
import { useEffect, useState } from "react";
import { Address, getAddress } from "viem";
import { Text, TextLink } from "../../shared/tailwind-catalyst/text";
import CodeSnippet from "../code-snippet";
import { ConfigPanel } from "../config-panel";
import { APP_ID, Container, printEvent, usePersistedConfig } from "../shared";

type Config = {
  recipientAddress: string; // Unified: EVM Address or Solana/Stellar string
  chainId: number; // Destination chain ID
  tokenAddress: string;
};

export default function DemoDeposit() {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = usePersistedConfig("rozo-deposit-config", {
    recipientAddress: "",
    chainId: 0,
    tokenAddress: "",
  } as Config);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [parsedConfig, setParsedConfig] = useState<Config | null>(null);

  const { resetPayment } = useRozoPayUI();

  const handleSetConfig = (config: Config) => {
    setConfig(config);
    setParsedConfig(config);

    // NOTE: This is used to reset the payment state when the config changes
    const isEvm = isEvmChain(config.chainId);
    const payParams: any = {
      toChain: config.chainId,
    };

    if (isEvm) {
      payParams.toAddress = getAddress(config.recipientAddress);
      payParams.toToken = getAddress(config.tokenAddress);
    } else {
      payParams.toAddress = config.recipientAddress;
      payParams.toToken = config.tokenAddress;
      if (isStellarChain(config.chainId)) {
        payParams.toStellarAddress = config.recipientAddress;
      } else if (isSolanaChain(config.chainId)) {
        payParams.toSolanaAddress = config.recipientAddress;
      }
    }

    resetPayment(payParams);
  };

  // Only render the RozoPayButton when we have valid config
  const hasValidConfig =
    parsedConfig &&
    parsedConfig.recipientAddress &&
    parsedConfig.chainId &&
    parsedConfig.tokenAddress;

  // Add escape key handler
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
      localStorage.getItem("rozo-deposit-config") || "{}"
    );

    if (getConfig && getConfig.chainId !== 0) {
      const parsedConfig: Config = {
        recipientAddress: getConfig.recipientAddress || "",
        chainId: getConfig.chainId || 0,
        tokenAddress: getConfig.tokenAddress || "",
      };

      // Validate and clean up config
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

  useEffect(() => {
    // Only generate code snippet if we have a complete config
    if (!hasValidConfig || !parsedConfig) {
      setCodeSnippet("");
      return;
    }

    const isEvm = isEvmChain(parsedConfig.chainId);
    const isSolana = isSolanaChain(parsedConfig.chainId);
    const isStellar = isStellarChain(parsedConfig.chainId);

    // For EVM chains, use getAddress helper
    // For non-EVM chains, use string directly
    const addressCode = isEvm
      ? `getAddress("${parsedConfig.recipientAddress}")`
      : `"${parsedConfig.recipientAddress}"`;

    // First check if it's a native token (address is 0x0)
    if (
      parsedConfig.tokenAddress ===
      getChainNativeToken(parsedConfig.chainId)?.token
    ) {
      const tokenVarName =
        getChainName(parsedConfig.chainId).toLowerCase() +
        getChainNativeToken(parsedConfig.chainId)?.symbol;
      if (tokenVarName) {
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

        const chainVarName = isEvm
          ? tokenVarName
          : isSolana
          ? "rozoSolanaUSDC"
          : "rozoStellarUSDC";

        const snippet = `${importStatement}
import { RozoPayButton } from "@rozoai/intent-pay";

<RozoPayButton
  appId="${APP_ID}"
  toChain={${chainVarName}.chainId}
  toAddress={${addressCode}}
  toToken={${tokenCode}}
  intent="Deposit"
/>`;
        setCodeSnippet(snippet);
        return;
      }
    }

    // For non-native tokens
    if (parsedConfig.chainId !== 0) {
      const token = knownTokens.find(
        (t) =>
          t.token === parsedConfig.tokenAddress &&
          t.chainId === parsedConfig.chainId
      );
      if (!token) return;

      // Find the variable name in pay-common exports
      const tokenVarName =
        Object.entries(Tokens).find(([_, t]) => t === token)?.[0] ||
        token.symbol;

      const tokenCode = isEvm
        ? `getAddress(${tokenVarName}.token)`
        : `${tokenVarName}.token`;

      const importStatement = isEvm
        ? `import { getAddress } from "viem";\nimport { ${tokenVarName} } from "@rozoai/intent-common";`
        : `import { ${tokenVarName} } from "@rozoai/intent-common";`;

      const snippet = `${importStatement}
import { RozoPayButton } from "@rozoai/intent-pay";
    
<RozoPayButton
  appId="${APP_ID}"
  toChain={${tokenVarName}.chainId}
  toAddress={${addressCode}}
  toToken={${tokenCode}}
  intent="Deposit"
/>`;
      setCodeSnippet(snippet);
    }
  }, [parsedConfig, hasValidConfig]);

  return (
    <Container className="max-w-4xl mx-auto p-6">
      <Text className="text-lg text-gray-700 mb-4">
        Onboard users to your app using the tokens they already own on other
        chains. Users can customize their deposit amount.
      </Text>

      <div className="flex flex-col items-center gap-8">
        {Boolean(hasValidConfig) && parsedConfig ? (
          <>
            <RozoPayButton
              appId={APP_ID}
              toChain={parsedConfig.chainId}
              toAddress={
                isEvmChain(parsedConfig.chainId)
                  ? (getAddress(parsedConfig.recipientAddress) as Address)
                  : parsedConfig.recipientAddress
              }
              toToken={
                isEvmChain(parsedConfig.chainId)
                  ? (getAddress(parsedConfig.tokenAddress) as Address)
                  : parsedConfig.tokenAddress
              }
              intent="Deposit"
              onPaymentStarted={printEvent}
              onPaymentCompleted={(e) => {
                printEvent(e);
                setTxHash(e.txHash);
              }}
              showProcessingPayout
            />
            {txHash && (
              <TextLink
                href={`https://basescan.org/tx/${txHash}`}
                target="_blank"
                className="text-primary-medium hover:text-primary-dark"
              >
                Transaction Successful ↗
              </TextLink>
            )}
            <button
              onClick={() => setIsConfigOpen(true)}
              className="bg-primary-dark text-white px-6 py-3 rounded-lg hover:bg-primary-medium transition-all"
            >
              Configure Deposit
            </button>
          </>
        ) : (
          <button
            onClick={() => setIsConfigOpen(true)}
            className="bg-primary-dark text-white px-6 py-3 rounded-lg hover:bg-primary-medium transition-all"
          >
            Create a Deposit
          </button>
        )}

        {/* Only show implementation code if we have a complete config */}
        {Boolean(hasValidConfig) && parsedConfig && (
          <div className="w-full">
            <Text className="text-lg font-medium text-primary-dark mb-2">
              Implementation Code
            </Text>
            <CodeSnippet codeSnippet={codeSnippet} />
          </div>
        )}

        <ConfigPanel
          configType="deposit"
          isOpen={isConfigOpen}
          onClose={() => setIsConfigOpen(false)}
          onConfirm={handleSetConfig}
          defaultRecipientAddress={config.recipientAddress}
        />

        {parsedConfig && isStellarChain(parsedConfig.chainId) && (
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              ℹ️ Stellar Deposit Configuration
            </h3>
            <p className="text-sm text-gray-700 mb-2">For Stellar deposits:</p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>
                <code className="bg-blue-100 px-1 rounded">toChain</code> is set
                to Stellar Chain ID: <strong>{rozoStellar.chainId}</strong>
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">toAddress</code> must
                be a valid Stellar address (starts with G, 56 characters)
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">toToken</code> is the
                asset code (e.g., &quot;USDC&quot;, &quot;XLM&quot;)
              </li>
            </ul>
          </div>
        )}

        {parsedConfig && isSolanaChain(parsedConfig.chainId) && (
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              ℹ️ Solana Deposit Configuration
            </h3>
            <p className="text-sm text-gray-700 mb-2">For Solana deposits:</p>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>
                <code className="bg-blue-100 px-1 rounded">toChain</code> is set
                to Solana Chain ID: <strong>{rozoSolana.chainId}</strong>
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">toAddress</code> must
                be a valid Solana address (Base58 encoded, 32-44 characters)
              </li>
              <li>
                <code className="bg-blue-100 px-1 rounded">toToken</code> is the
                token mint address
              </li>
            </ul>
          </div>
        )}
      </div>
    </Container>
  );
}
