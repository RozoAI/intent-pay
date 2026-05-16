"use client";

import {
  baseUSDC,
  createPayment,
  getAddressContraction,
  getChainById,
  PaymentStartedEvent,
} from "@rozoai/intent-common";
import { RozoPayButton } from "@rozoai/intent-pay";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Address, getAddress } from "viem";
import { Code, Text, TextLink } from "../../shared/tailwind-catalyst/text";
import { ConfigPanel, PaymentConfig } from "../config-panel";
import { APP_ID, Container, printEvent } from "../shared";

export default function DemoCheckout() {
  const [payId, setPayId] = useState<string>();
  const [manualPayId, setManualPayId] = useState<string>("");
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

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
  }, []);

  /**
   * Create a payment using the Rozo API, then pass the resulting payment ID
   * to the RozoPayButton via payId. This prevents the SDK from re-creating
   * a payment when the user selects a token.
   */
  const handleCreatePayment = useCallback(async () => {
    if (!parsed) return;

    setIsCreating(true);
    try {
      const response = await createPayment({
        appId: APP_ID,
        toChain: parsed.toChain,
        toToken: parsed.toToken,
        toAddress: parsed.toAddress,
        toUnits: parsed.toUnits,
        // For the initial creation, use the destination chain/token as preferred.
        // The SDK will handle cross-chain routing when the user picks a different source.
        preferredChain: parsed.toChain,
        preferredTokenAddress: parsed.toToken,
        title: "Checkout Payment",
      });

      if (response?.id) {
        setPayId(response.id);
        setManualPayId(response.id);
      } else {
        console.error("[Checkout] Payment creation failed:", response);
      }
    } catch (error) {
      console.error("[Checkout] Failed to create payment:", error);
    } finally {
      setIsCreating(false);
    }
  }, [parsed]);

  /** Apply a manually entered payId */
  const handleApplyManualPayId = useCallback(() => {
    const trimmed = manualPayId.trim();
    if (trimmed) {
      setPayId(trimmed);
    }
  }, [manualPayId]);

  const handleSetConfig = useCallback(
    (newConfig: PaymentConfig) => {
      setConfig(newConfig);
      setPayId(undefined);
      setManualPayId("");

      // Keep this page consistent with `ConfigPanel` reload behavior.
      try {
        localStorage.setItem("rozo-basic-config", JSON.stringify(newConfig));
      } catch {
        // ignore
      }
    },
    [],
  );

  return (
    <Container className="mx-auto w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary-medium">
          Checkout Demo
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">
          Pre-created Payment (payId)
        </h1>
        <Text className="max-w-2xl text-base leading-7 text-gray-600">
          Create a payment up-front via the API, then pass the pay ID to the
          SDK. The SDK fetches the payment details and skips re-creation when
          the user selects a token.
        </Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)]">
        <section className="space-y-6">
          {/* Create payment from config */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-5">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Option A: Create from config
                </h2>
                <Text className="text-sm leading-6 text-gray-600">
                  Set destination details, then create a payment. The returned
                  pay ID is used below.
                </Text>
              </div>

              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
                {parsed ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Chain
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
                    No config yet. Open the config drawer to set destination
                    details.
                  </Text>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {parsed && (
                  <button
                    onClick={handleCreatePayment}
                    disabled={isCreating}
                    className="min-h-12 flex-1 rounded-xl bg-primary-dark px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-medium disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreating
                      ? "Creating..."
                      : payId
                        ? "Re-create Payment"
                        : "Create Payment"}
                  </button>
                )}
                <button
                  onClick={() => setIsConfigOpen(true)}
                  className="min-h-12 rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                >
                  {parsed ? "Edit Config" : "Open Config"}
                </button>
              </div>
            </div>
          </div>

          {/* Manual payId input */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-gray-900">
                  Option B: Enter pay ID manually
                </h2>
                <Text className="text-sm leading-6 text-gray-600">
                  Paste a pay ID from your backend or another source.
                </Text>
              </div>

              <div className="flex gap-3">
                <input
                  type="text"
                  value={manualPayId}
                  onChange={(e) => setManualPayId(e.target.value)}
                  placeholder="Enter payment ID (UUID)..."
                  className="min-h-12 flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-medium focus:outline-none focus:ring-1 focus:ring-primary-medium"
                />
                <button
                  onClick={handleApplyManualPayId}
                  disabled={!manualPayId.trim()}
                  className="min-h-12 rounded-xl bg-gray-900 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* Pay button */}
          {payId && (
            <div className="rounded-2xl border-2 border-primary-dark bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4">
                <div className="space-y-1">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Ready to pay
                  </h2>
                  <p className="break-all text-xs text-gray-500">
                    Using pay ID: {payId}
                  </p>
                </div>

                <RozoPayButton.Custom key={payId} payId={payId} onPaymentStarted={start}>
                  {(renderProps) => (
                    <button
                      onClick={renderProps.show}
                      className="min-h-12 w-full rounded-xl bg-primary-dark px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-medium"
                    >
                      Make Payment
                    </button>
                  )}
                </RozoPayButton.Custom>
              </div>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
              Active Pay ID
            </p>
            <div aria-live="polite" className="mt-3 space-y-2">
              <p className="break-all text-lg font-semibold text-gray-900">
                {payId ? getAddressContraction(payId) : "None"}
              </p>
              {payId && (
                <p className="break-all text-xs text-gray-400">{payId}</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              How it works
            </h3>
            <Text className="mt-2 text-sm leading-6 text-gray-600">
              1. Create a payment via the API (or paste an existing ID).
              <br />
              2. The <Code>payId</Code> prop is passed to{" "}
              <Code>RozoPayButton</Code>.
              <br />
              3. The SDK auto-fetches the payment and validates it&apos;s
              unpaid.
              <br />
              4. When the user picks a token, no new payment is created.
              <br />
              5. Changing <Code>payId</Code> auto-resets the SDK state.
            </Text>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900">
              SDK behavior
            </h3>
            <Text className="mt-2 text-sm leading-6 text-gray-600">
              <strong>No manual reset needed.</strong> When <Code>payId</Code>{" "}
              changes, the SDK automatically resets its internal state and
              fetches the new payment. Only <Code>payment_unpaid</Code> payments
              are accepted — other statuses show an error.
            </Text>
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
