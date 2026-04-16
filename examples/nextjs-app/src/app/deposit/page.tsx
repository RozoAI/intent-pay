"use client";

import * as Tokens from "@rozoai/intent-common";
import {
  getChainById,
  getChainExplorerByChainId,
  getChainName,
  getChainNativeToken,
  knownTokens,
  rozoSolana,
  rozoStellar,
} from "@rozoai/intent-common";
import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
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
  const [completedTx, setCompletedTx] = useState<{
    hash: string;
    chainId: number;
  } | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [config, setConfig] = usePersistedConfig("rozo-deposit-config", {
    recipientAddress: "",
    chainId: 0,
    tokenAddress: "",
  } as Config);
  const [codeSnippet, setCodeSnippet] = useState("");
  const [parsedConfig, setParsedConfig] = useState<Config | null>(null);

  const { resetPayment } = useRozoPayUI();

  const toAddressCode = (address: string, isEvmChain: boolean) =>
    isEvmChain ? `getAddress("${address}")` : `"${address}"`;

  const handleSetConfig = (config: Config) => {
    setConfig(config);
    setParsedConfig(config);

    // NOTE: This is used to reset the payment state when the config changes
    const chain = getChainById(config.chainId);
    if (!chain) return;
    const isEvm = chain.type === "evm";
    const isSolana = chain.type === "solana";
    const isStellar = chain.type === "stellar";
    const payParams: any = {
      toChain: config.chainId,
    };

    if (isEvm) {
      payParams.toAddress = getAddress(config.recipientAddress);
      payParams.toToken = getAddress(config.tokenAddress);
    } else {
      payParams.toAddress = config.recipientAddress;
      payParams.toToken = config.tokenAddress;
      if (isStellar) {
        payParams.toStellarAddress = config.recipientAddress;
      } else if (isSolana) {
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
    try {
      const getConfig = JSON.parse(
        localStorage.getItem("rozo-deposit-config") || "{}",
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
    } catch {
      // Ignore malformed saved config and fall back to defaults.
    }
  }, []);

  useEffect(() => {
    // Only generate code snippet if we have a complete config
    if (!hasValidConfig || !parsedConfig) {
      setCodeSnippet("");
      return;
    }

    const chain = getChainById(parsedConfig.chainId);
    if (!chain) return;
    const isEvm = chain.type === "evm";
    const isSolana = chain.type === "solana";
    const isStellar = chain.type === "stellar";

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
          : `${tokenVarName}.token`;

        const importStatement = isEvm
          ? `import { getAddress } from "viem";\nimport { ${tokenVarName} } from "@rozoai/intent-common";`
          : `import { ${tokenVarName} } from "@rozoai/intent-common";`;

        const snippet = `${importStatement}
import { RozoPayButton } from "@rozoai/intent-pay";

<RozoPayButton
  appId="${APP_ID}"
  toChain={${tokenVarName}.chainId}
  toAddress={${toAddressCode(parsedConfig.recipientAddress, isEvm)}}
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
          t.chainId === parsedConfig.chainId,
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
  toAddress={${toAddressCode(parsedConfig.recipientAddress, isEvm)}}
  toToken={${tokenCode}}
  intent="Deposit"
/>`;
      setCodeSnippet(snippet);
    }
  }, [parsedConfig, hasValidConfig]);

  const isEvm = parsedConfig?.chainId
    ? getChainById(parsedConfig.chainId)?.type === "evm"
    : false;
  const isSolana = parsedConfig?.chainId
    ? getChainById(parsedConfig.chainId)?.type === "solana"
    : false;
  const isStellar = parsedConfig?.chainId
    ? getChainById(parsedConfig.chainId)?.type === "stellar"
    : false;

  return (
    <Container className="mx-auto w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary-medium">
          Deposit Demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">
          Configure a deposit flow for cross-chain onboarding
        </h1>
        <Text className="max-w-2xl text-base leading-7 text-gray-600">
          Let users deposit with assets they already hold on other chains, while
          keeping the integration details easy to inspect and copy.
        </Text>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Deposit setup</p>
          <Text className="text-sm text-gray-600">
            Configure the destination chain, token, and receiving address before
            opening the deposit flow.
          </Text>
        </div>
        <button
          onClick={() => setIsConfigOpen(true)}
          className="min-h-11 rounded-xl bg-primary-dark px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-medium"
        >
          {hasValidConfig ? "Edit deposit config" : "Create a deposit"}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="flex flex-col gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Deposit runner
                </h2>
                <Text className="text-sm leading-6 text-gray-600">
                  Launch the deposit flow with the currently configured
                  destination settings.
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
                        Token
                      </p>
                      <p className="mt-1 break-all text-sm font-medium text-gray-900">
                        {parsedConfig.tokenAddress}
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

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <RozoPayButton
                      appId={APP_ID}
                      toChain={parsedConfig.chainId}
                      toAddress={
                        isEvm
                          ? (getAddress(
                              parsedConfig.recipientAddress,
                            ) as Address)
                          : parsedConfig.recipientAddress
                      }
                      toToken={
                        isEvm
                          ? (getAddress(parsedConfig.tokenAddress) as Address)
                          : parsedConfig.tokenAddress
                      }
                      intent="Deposit"
                      onPaymentStarted={printEvent}
                      onPaymentCompleted={(e) => {
                        printEvent(e);
                        setCompletedTx({
                          hash: String(e.txHash),
                          chainId: e.chainId,
                        });
                      }}
                      showProcessingPayout
                    />
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
                    Set the receiving chain, token, and address to enable the
                    deposit flow and generated implementation code.
                  </Text>
                </div>
              )}
            </div>
          </section>

          {Boolean(hasValidConfig) && parsedConfig && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-5 space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Implementation code
                </h2>
                <Text className="text-sm leading-6 text-gray-600">
                  Copy this snippet to reproduce the current deposit
                  configuration in your own app.
                </Text>
              </div>
              <CodeSnippet codeSnippet={codeSnippet} />
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
              Deposit status
            </p>
            <div aria-live="polite" className="mt-3 space-y-2">
              <p className="text-sm text-gray-500">Latest transaction</p>
              <p className="break-all text-sm font-medium text-gray-900">
                {completedTx?.hash ?? "TBD"}
              </p>
            </div>
            {completedTx && (
              <TextLink
                href={`${getChainExplorerByChainId(completedTx.chainId)}/tx/${completedTx.hash}`}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-4 inline-flex text-sm font-medium text-primary-medium hover:text-primary-dark"
              >
                View successful transaction ↗
              </TextLink>
            )}
          </section>

          {(parsedConfig && isStellar) || (parsedConfig && isSolana) ? (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              {parsedConfig && isStellar && (
                <>
                  <h3 className="text-base font-semibold text-blue-900">
                    Stellar deposit notes
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
                      is the Stellar asset code.
                    </li>
                  </ul>
                </>
              )}

              {parsedConfig && isSolana && (
                <>
                  <h3 className="text-base font-semibold text-blue-900">
                    Solana deposit notes
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
                      is the token mint address.
                    </li>
                  </ul>
                </>
              )}
            </section>
          ) : null}

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Key props</h3>
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
                  The destination chain where the deposit settles.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-gray-900">
                  toToken
                </dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  The destination token contract address or chain-specific token
                  identifier.
                </dd>
              </div>
              <div>
                <dt className="font-mono font-semibold text-gray-900">
                  toAddress
                </dt>
                <dd className="mt-1 leading-6 text-gray-600">
                  The receiving wallet address for the deposit.
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>

      <ConfigPanel
        configType="deposit"
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfirm={handleSetConfig}
        defaultRecipientAddress={config.recipientAddress}
      />
    </Container>
  );
}
