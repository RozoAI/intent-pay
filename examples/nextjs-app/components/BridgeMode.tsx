"use client"

import { Button } from "@/components/ui/button"
import { useSharedConfig } from "@/hooks/useSharedConfig"
import { generateBridgeSnippet } from "@/lib/snippets"
import { getKnownToken, TokenSymbol } from "@rozoai/intent-common"
import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay"
import { useCallback, useEffect, useId, useState } from "react"
import { CodeSnippet } from "./CodeSnippet"
import { EventLog, type LogEntry } from "./EventLog"
import { ModeDescription } from "./ModeDescription"
import { ParamForm, type ParamFormValues } from "./ParamForm"
import { PreviewPane } from "./PreviewPane"

const APP_ID = "rozoDemo"

export function BridgeMode() {
  const [config, setConfig, hydrated] = useSharedConfig()
  const { resetPayment } = useRozoPayUI()
  const [ready, setReady] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const uid = useId()

  const isConfigValid =
    config.toChain > 0 &&
    config.toToken !== "" &&
    config.toAddress !== "" &&
    config.toUnits !== ""

  const knownToken = getKnownToken(config.toChain, config.toToken)
  const isDestinationEURC = knownToken
    ? knownToken.symbol === TokenSymbol.EURC
    : false

  const preferredSymbol = isDestinationEURC
    ? [TokenSymbol.EURC]
    : [TokenSymbol.USDC, TokenSymbol.USDT]

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        { id: `${uid}-${Date.now()}`, type, payload },
      ])
    },
    [uid]
  )

  const applyConfig = useCallback(
    async (c: ParamFormValues) => {
      if (!c.toChain || !c.toToken || !c.toAddress || !c.toUnits) return
      setResetting(true)
      setReady(false)
      setResetError(null)
      try {
        await resetPayment({
          appId: APP_ID,
          toChain: c.toChain,
          toToken: c.toToken,
          toAddress: c.toAddress,
          toUnits: c.toUnits,
          intent: "Bridge",
          preferredSymbol,
        })
        setReady(true)
      } catch (err) {
        setResetError(
          err instanceof Error ? err.message : "Failed to initialize payment"
        )
      } finally {
        setResetting(false)
      }
    },
    [resetPayment, preferredSymbol]
  )

  const handleChange = useCallback(
    (values: ParamFormValues) => {
      setConfig(values)
      applyConfig(values)
    },
    [setConfig, applyConfig]
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hydrated) applyConfig(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const snippet = isConfigValid ? generateBridgeSnippet(config) : ""

  const preview = (
    <div className="flex flex-col items-center gap-6 py-4">
      {isConfigValid ? (
        <div className="flex flex-col items-center gap-2">
          <RozoPayButton.Custom
            appId={APP_ID}
            toChain={config.toChain}
            toToken={config.toToken}
            toAddress={config.toAddress}
            toUnits={config.toUnits}
            preferredSymbol={preferredSymbol}
            resetOnSuccess
            showProcessingPayout
            intent="Bridge"
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
          {resetError && (
            <div className="flex items-center gap-2">
              <p className="text-xs text-destructive">{resetError}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => applyConfig(config)}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Fill in all fields to enable the payment button.
        </p>
      )}
      <div className="w-full">
        <EventLog entries={logs} onClear={() => setLogs([])} />
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <ModeDescription
        title="Bridge"
        summary="Send a fixed token amount cross-chain. You specify the destination chain, token, address, and exact amount. Rozo handles bridging from any source chain; the user sees available tokens in their wallet and picks one."
        steps={[
          { step: 1, label: "Set destination chain, token, address & amount" },
          { step: 2, label: "SDK calls resetPayment() to lock in params" },
          { step: 3, label: "User opens modal, picks source token & pays" },
          { step: 4, label: "Rozo bridges funds to destination" },
        ]}
        note="Use this when you need to receive an exact amount, e.g. a product costs $5 USDC on Base."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4" aria-label="Configuration">
          <p className="text-xs font-medium text-muted-foreground">
            Configuration
          </p>
          <ParamForm
            values={config}
            onChange={handleChange}
            showAmount
            hydrated={hydrated}
          />
        </aside>
        <main>
          <PreviewPane
            preview={preview}
            code={snippet ? <CodeSnippet code={snippet} /> : null}
          />
        </main>
      </div>
    </div>
  )
}
