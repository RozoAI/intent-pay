"use client";

import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import {
  baseUSDC,
  getAddressContraction,
  getChainById,
  PaymentStartedEvent,
} from "@rozoai/intent-common";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, getAddress } from "viem";
import { Code, Text, TextLink } from "../../shared/tailwind-catalyst/text";
import { ConfigPanel, PaymentConfig } from "../config-panel";
import {
  APP_ID,
  Columns,
  Container,
  printEvent,
} from "../shared";

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
          toToken: isEvm ? getAddress(newConfig.tokenAddress) : newConfig.tokenAddress,
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
    <Container>
      <Text>
        For robust checkout, save the payId in <Code>onPaymentStarted</Code>.
        This ensures you&apos;ll be able to correlate incoming payments with a
        cart (or a user ID, form submission, etc) even if the user closes the
        tab.
      </Text>
      <Text>
        In addition to callbacks like <Code>onPaymentSucceeded</Code>, Rozo Pay
        supports{" "}
        <TextLink href="https://paydocs.daimo.com/webhooks">webhooks</TextLink>{" "}
        to track payment status reliably on the backend.
      </Text>
      <div />
      <Columns>
        <div className="flex-1">
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
                  className="w-full bg-primary-dark text-white px-6 py-3 rounded-lg hover:bg-primary-medium transition-all font-medium"
                >
                  Make Payment
                </button>
              )}
            </RozoPayButton.Custom>
          ) : (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="w-full border-2 border-primary-dark text-primary-dark px-6 py-3 rounded-lg hover:bg-primary-dark hover:text-white transition-all font-medium"
            >
              Configure Payment Settings
            </button>
          )}
        </div>
        <div className="flex-1">
          <Text>PayID {payId ? getAddressContraction(payId) : "TBD"}</Text>
        </div>
      </Columns>

      <ConfigPanel
        configType="payment"
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        onConfirm={(c) => handleSetConfig(c as PaymentConfig)}
        defaultRecipientAddress={config.recipientAddress}
      />

      <Text>
        <TextLink
          href="https://github.com/RozoAI/intent-pay/blob/master/examples/nextjs-app/src/app/checkout"
          target="_blank"
        >
          View on Github ↗
        </TextLink>
      </Text>
    </Container>
  );
}
