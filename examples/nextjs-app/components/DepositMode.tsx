"use client"

import { Button } from "@/components/ui/button"
import { useSharedConfig } from "@/hooks/useSharedConfig"
import { generateDepositSnippet } from "@/lib/snippets"
import { getKnownToken, TokenSymbol } from "@rozoai/intent-common"
import { RozoPayButton, useRozoPayUI } from "@rozoai/intent-pay"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { CodeSnippet } from "./CodeSnippet"
import { EventLog, type LogEntry } from "./EventLog"
import { ModeDescription } from "./ModeDescription"
import { ParamForm, type ParamFormValues } from "./ParamForm"
import { PreviewPane } from "./PreviewPane"

const APP_ID = "rozoDemo"

export function DepositMode() {
  const [config, setConfig, hydrated] = useSharedConfig()
  const { resetPayment } = useRozoPayUI()
  const [pending, setPending] = useState(config)
  const [ready, setReady] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const uid = useId()

  // sync pending when storage hydrates
  useEffect(() => {
    if (hydrated) setPending(config)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const isPendingValid =
    pending.toChain > 0 && pending.toToken !== "" && pending.toAddress !== ""

  const isDirty = useMemo(
    () => JSON.stringify(pending) !== JSON.stringify(config),
    [pending, config]
  )

  const isConfigValid =
    config.toChain > 0 && config.toToken !== "" && config.toAddress !== ""

  const knownToken = getKnownToken(config.toChain, config.toToken)
  const isDestinationEURC = knownToken
    ? knownToken.symbol === TokenSymbol.EURC
    : false

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const preferredSymbol = isDestinationEURC
    ? [TokenSymbol.EURC]
    : [TokenSymbol.USDC, TokenSymbol.USDT]

  const addLog = useCallback(
    (type: LogEntry["type"], payload: unknown) => {
      setLogs((prev) => [
        ...prev,
        { id: `${uid}-${Date.now()}`, type, timestamp: Date.now(), payload },
      ])
    },
    [uid]
  )

  const applyConfig = useCallback(
    async (c: ParamFormValues) => {
      if (!c.toChain || !c.toToken || !c.toAddress) return
      setResetting(true)
      setReady(false)
      setResetError(null)
      try {
        await resetPayment({
          toChain: c.toChain,
          toToken: c.toToken,
          toAddress: c.toAddress,
          toUnits: undefined, // explicit clear — user sets amount inside modal
          intent: "Deposit",
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

  const handleConfirm = useCallback(async () => {
    setConfig(pending)
    await applyConfig(pending)
  }, [setConfig, pending, applyConfig])

  // On hydration, RozoPayButton already picks up config props — no resetPayment needed.
  // Just mark ready so Deposit is enabled.
  useEffect(() => {
    if (hydrated && isConfigValid) setReady(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const snippet = isConfigValid ? generateDepositSnippet(config) : ""

  const preview = (
    <div className="flex flex-col items-center gap-6 py-4">
      {isConfigValid ? (
        <div className="flex flex-col items-center gap-2">
          <RozoPayButton.Custom
            appId={APP_ID}
            toChain={config.toChain}
            toToken={config.toToken}
            toAddress={config.toAddress}
            preferredSymbol={preferredSymbol}
            intent="Deposit"
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
                {resetting ? "Preparing…" : "Deposit"}
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
          Fill in all fields to enable the deposit button.
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
        title="Wallet Deposit"
        summary="Open-ended deposit flow where the user enters the amount inside the modal. No fixed amount is set upfront; you only specify destination chain, token, and address. Suitable for top-ups, wallets, and donation flows."
        steps={[
          {
            step: 1,
            label: "Set destination chain, token & address (no amount)",
          },
          { step: 2, label: "SDK calls resetPayment() without toUnits" },
          { step: 3, label: "User opens modal and enters how much to deposit" },
          { step: 4, label: "Rozo bridges funds to destination" },
        ]}
        note="No toUnits is passed to RozoPayButton; the SDK renders an amount input inside the modal."
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4" aria-label="Configuration">
          <p className="text-xs font-medium text-muted-foreground">
            Configuration
          </p>
          <ParamForm
            values={pending}
            onChange={setPending}
            showAmount={false}
            hydrated={hydrated}
          />
          <Button
            onClick={handleConfirm}
            disabled={!isPendingValid || !isDirty || resetting}
            size="sm"
            className="w-full"
          >
            {resetting ? "Applying…" : "Confirm"}
          </Button>
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
