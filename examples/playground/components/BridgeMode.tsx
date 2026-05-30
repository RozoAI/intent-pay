"use client";

import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay";
import { useCallback, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeSnippet } from "./CodeSnippet";
import { EventLog, type LogEntry } from "./EventLog";
import { ParamForm, type ParamFormValues } from "./ParamForm";
import { PreviewPane } from "./PreviewPane";
import { usePlaygroundConfig } from "@/hooks/usePlaygroundConfig";
import { generateBridgeSnippet } from "@/lib/snippets";

const APP_ID = "rozoDemo";

const DEFAULTS: ParamFormValues = {
  toChain: 8453,
  toToken: "",
  toAddress: "",
  toUnits: "",
};

export function BridgeMode() {
  const [config, setConfig] = usePlaygroundConfig<ParamFormValues>(
    "playground-bridge",
    DEFAULTS,
  );
  const { resetPayment } = useRozoPayUI();
  const [ready, setReady] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const uid = useId();

  const isConfigValid =
    config.toChain > 0 &&
    config.toToken !== "" &&
    config.toAddress !== "" &&
    config.toUnits !== "";

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        { id: `${uid}-${Date.now()}`, type, payload },
      ]);
    },
    [uid],
  );

  const applyConfig = useCallback(
    async (c: ParamFormValues) => {
      if (!c.toChain || !c.toToken || !c.toAddress || !c.toUnits) return;
      setResetting(true);
      setReady(false);
      try {
        await resetPayment({
          toChain: c.toChain,
          toToken: c.toToken,
          toAddress: c.toAddress,
          toUnits: c.toUnits,
        });
        setReady(true);
      } finally {
        setResetting(false);
      }
    },
    [resetPayment],
  );

  const handleChange = useCallback(
    (values: ParamFormValues) => {
      setConfig(values);
      applyConfig(values);
    },
    [setConfig, applyConfig],
  );

  useEffect(() => {
    applyConfig(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const snippet = isConfigValid ? generateBridgeSnippet(config) : "";

  const preview = (
    <div className="flex flex-col items-center gap-6 py-4">
      {isConfigValid ? (
        <RozoPayButton.Custom
          appId={APP_ID}
          toChain={config.toChain}
          toToken={config.toToken}
          toAddress={config.toAddress}
          toUnits={config.toUnits}
          resetOnSuccess
          showProcessingPayout
          onPaymentStarted={(e) => addLog("started", e)}
          onPaymentCompleted={(e) => addLog("completed", e)}
          onPayoutCompleted={(e) => addLog("payout", e)}
        >
          {({ show }) => (
            <Button
              onClick={show}
              disabled={!ready || resetting}
              size="lg"
              className="min-w-40"
            >
              {resetting ? "Preparing…" : "Pay Now"}
            </Button>
          )}
        </RozoPayButton.Custom>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to enable the payment button.
        </p>
      )}
      <div className="w-full">
        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">
          Events
        </p>
        <EventLog entries={logs} />
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-[280px_1fr] gap-6">
      <aside className="space-y-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Configuration
        </p>
        <ParamForm values={config} onChange={handleChange} showAmount />
      </aside>
      <main>
        <PreviewPane
          preview={preview}
          code={snippet ? <CodeSnippet code={snippet} /> : null}
        />
      </main>
    </div>
  );
}
