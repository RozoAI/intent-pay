"use client";

import {
  baseUSDC,
  getAddressContraction,
  getChainById,
  PaymentStartedEvent,
} from "@rozoai/intent-common";
import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, getAddress } from "viem";
import { Code, Text, TextLink } from "../../shared/tailwind-catalyst/text";
import { ConfigPanel, PaymentConfig } from "../config-panel";
import { APP_ID, Container, printEvent } from "../shared";

export default function DemoCheckout() {
  const [payId, setPayId] = useState<string>();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const { resetPayment } = useRozoPayUI();

  const [config, setConfig] = useState<PaymentConfig>({
    recipientAddress: "",
    chainId: baseUSDC.chainId,
    tokenAddress: baseUSDC.token,
    amount: "0.42",
  });

  // Match `ConfigPanel`'s localStorage key so the UI and this page stay in sync.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rozo-basic-config");
      if (!saved) return;

      const parsed = JSON.parse(saved) as Partial<PaymentConfig>;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !("recipientAddress" in parsed) ||
        !("chainId" in parsed) ||
        !("tokenAddress" in parsed) ||
        !("amount" in parsed)
      ) {
        return;
      }

      setConfig({
        recipientAddress: String(parsed.recipientAddress ?? ""),
        chainId: Number(parsed.chainId ?? baseUSDC.chainId),
        tokenAddress: String(parsed.tokenAddress ?? ""),
        amount: String(parsed.amount ?? "0.42"),
      });
    } catch {
      // ignore
    }
  }, []);

  const parsed = useMemo(() => {
    if (
      !config?.recipientAddress ||
      !config?.chainId ||
      !config?.tokenAddress ||
      !config?.amount
    ) {
      return null;
    }

    const chain = getChainById(config.chainId);
    if (!chain) return null;

    const isEvm = chain.type === "evm";

    try {
      const toAddress = isEvm
        ? (getAddress(config.recipientAddress) as Address)
        : config.recipientAddress;
      const toToken = isEvm
        ? getAddress(config.tokenAddress)
        : config.tokenAddress;

      return {
        toChain: config.chainId,
        toUnits: config.amount,
        toAddress,
        toToken,
      };
    } catch {
      return null;
    }
  }, [config]);

  const start = useCallback((e: PaymentStartedEvent) => {
    printEvent(e);
    setPayId(e.paymentId);
    // Save payId to your backend here. This ensures that you'll be able to
    // correlate all incoming payments even if the user loses network, etc.
    //
    // For example:
    // await saveCartCheckout(payId, ...);
  }, []);

  const handleSetConfig = useCallback(
    (newConfig: PaymentConfig) => {
      setConfig(newConfig);
      setPayId(undefined);

      // Keep this page consistent with `ConfigPanel` reload behavior.
      try {
        localStorage.setItem("rozo-basic-config", JSON.stringify(newConfig));
      } catch {
        // ignore
      }

      const chain = getChainById(newConfig.chainId);
      if (!chain) return;

      const isEvm = chain.type === "evm";

      try {
        const payParams: any = {
          toChain: newConfig.chainId,
          toUnits: newConfig.amount,
          toAddress: isEvm
            ? getAddress(newConfig.recipientAddress)
            : newConfig.recipientAddress,
          toToken: isEvm
            ? getAddress(newConfig.tokenAddress)
            : newConfig.tokenAddress,
        };

        // Reset FSM so the payment flow uses the new destination.
        resetPayment(payParams);
      } catch {
        // If user enters invalid EVM addresses, don't reset.
      }
    },
    [resetPayment],
  );

  return (
    <Container className="mx-auto w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary-medium">
          Checkout Demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">
          Test a production-style checkout flow
        </h1>
        <Text className="max-w-2xl text-base leading-7 text-gray-600">
          Configure a destination wallet and token, then start a payment while
          tracking the generated pay ID for backend correlation.
        </Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-900">
                Payment action
              </h2>
              <Text className="text-sm leading-6 text-gray-600">
                Use the config drawer to set destination chain, token, address,
                and amount before launching the payment modal.
              </Text>
            </div>

            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
              {parsed ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Destination chain
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {parsed.toChain}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Amount
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {parsed.toUnits}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Recipient
                    </p>
                    <p className="mt-1 break-all text-sm text-gray-700">
                      {config.recipientAddress}
                    </p>
                  </div>
                </div>
              ) : (
                <Text className="text-sm leading-6 text-gray-600">
                  No payment configuration yet. Set the destination details to
                  enable the checkout button.
                </Text>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {parsed ? (
                <RozoPayButton.Custom
                  appId={APP_ID}
                  toChain={parsed.toChain}
                  toAddress={parsed.toAddress}
                  toToken={parsed.toToken}
                  toUnits={parsed.toUnits}
                  intent="Purchase"
                  onPaymentStarted={start}
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
              ) : (
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="min-h-12 flex-1 rounded-xl bg-primary-dark px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-medium"
                >
                  Configure Payment Settings
                </button>
              )}

              <button
                onClick={() => setIsConfigOpen(true)}
                className="min-h-12 rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
              >
                {parsed ? "Edit Configuration" : "Open Config"}
              </button>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
              Payment status
            </p>
            <div aria-live="polite" className="mt-3 space-y-2">
              <p className="text-sm text-gray-500">Latest PayID</p>
              <p className="break-all text-lg font-semibold text-gray-900">
                {payId ? getAddressContraction(payId) : "TBD"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              Backend note
            </h3>
            <Text className="mt-2 text-sm leading-6 text-gray-600">
              Save the pay ID from <Code>onPaymentStarted</Code> so you can
              reconcile payments even if the user closes the tab.
            </Text>
            <TextLink
              href="https://docs.rozo.ai/integration/rozointentpay/api-reference#event-handlers-recommended"
              className="mt-4 inline-flex text-sm font-medium"
            >
              Read event handler docs
            </TextLink>
          </section>

          <Text className="text-sm text-gray-500">
            <TextLink
              href="https://github.com/RozoAI/intent-pay/blob/master/examples/nextjs-app/src/app/checkout"
              target="_blank"
              rel="noreferrer noopener"
            >
              View on Github ↗
            </TextLink>
          </Text>
        </aside>
      </div>

      <ConfigPanel
        configType="payment"
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfirm={(c) => handleSetConfig(c as PaymentConfig)}
        defaultRecipientAddress={config.recipientAddress}
      />
    </Container>
  );
}
