"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getSupportedChains, getTokensForChain } from "@/lib/chains"
import { validateAddressForChain } from "@rozoai/intent-common"
import { useEffect, useMemo } from "react"

export interface ParamFormValues {
  toChain: number
  toToken: string
  toAddress: string
  toUnits: string
}

interface ParamFormProps {
  values: ParamFormValues
  onChange: (values: ParamFormValues) => void
  showAmount?: boolean
  hydrated?: boolean
}

const chains = getSupportedChains()

export function ParamForm({
  values,
  onChange,
  showAmount = true,
  hydrated = true,
}: ParamFormProps) {
  const tokens = useMemo(
    () => getTokensForChain(values.toChain),
    [values.toChain]
  )

  const selectedChain = useMemo(
    () => chains.find((c) => c.chainId === values.toChain),
    [values.toChain]
  )

  const selectedToken = useMemo(
    () => tokens.find((t) => t.token === values.toToken),
    [tokens, values.toToken]
  )

  const addressPlaceholder = useMemo(() => {
    if (!selectedChain) return "0x… or Solana/Stellar address"
    switch (selectedChain.type) {
      case "solana":
        return "e.g. 9no8…Bzr (Solana address)"
      case "stellar":
        return "e.g. GABC…XYZ (Stellar G-address)"
      default:
        return "e.g. 0x1234…abcd (EVM address)"
    }
  }, [selectedChain])

  const addressError = useMemo(() => {
    if (!values.toAddress || !values.toChain) return null
    return validateAddressForChain(values.toChain, values.toAddress)
      ? null
      : `Invalid ${selectedChain?.type?.toUpperCase() ?? ""} address`
  }, [values.toAddress, values.toChain, selectedChain])

  // Reset token when chain changes and current token not available on new chain.
  // Skip until hydrated to avoid overwriting localStorage before saved config loads.
  useEffect(() => {
    if (!hydrated) return
    const tokenExists = tokens.some((t) => t.token === values.toToken)
    if (!tokenExists && tokens.length > 0) {
      onChange({ ...values, toToken: tokens[0].token })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, hydrated])

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Destination Chain
        </Label>
        <Select
          value={String(values.toChain)}
          onValueChange={(v) => {
            const newChainId = Number(v)
            const newChain = chains.find((c) => c.chainId === newChainId)
            const typeChanged = newChain?.type !== selectedChain?.type
            onChange({
              ...values,
              toChain: newChainId,
              toToken: "",
              toAddress: typeChanged ? "" : values.toAddress,
            })
          }}
        >
          <SelectTrigger className="w-full border-border bg-secondary">
            <SelectValue placeholder="Select chain">
              {selectedChain && (
                <span className="flex items-center gap-2">
                  {selectedChain.LogoComponent && (
                    <selectedChain.LogoComponent
                      width={18}
                      height={18}
                      className="shrink-0 rounded-full"
                    />
                  )}
                  {selectedChain.name}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {chains.map((c) => (
              <SelectItem key={c.chainId} value={String(c.chainId)}>
                <span className="flex items-center gap-2">
                  {c.LogoComponent && (
                    <c.LogoComponent
                      width={18}
                      height={18}
                      className="shrink-0 rounded-full"
                    />
                  )}
                  {c.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Destination Token
        </Label>
        <Select
          value={values.toToken}
          onValueChange={(v) => onChange({ ...values, toToken: v })}
          disabled={tokens.length === 0}
        >
          <SelectTrigger className="w-full border-border bg-secondary">
            <SelectValue placeholder="Select token">
              {selectedToken && (
                <span className="flex items-center gap-2">
                  {selectedToken.logoUrl && (
                    <img
                      src={selectedToken.logoUrl}
                      alt={selectedToken.symbol}
                      width={18}
                      height={18}
                      className="shrink-0 rounded-full"
                    />
                  )}
                  {selectedToken.symbol}
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem key={t.token} value={t.token}>
                <span className="flex items-center gap-2">
                  {t.logoUrl && (
                    <img
                      src={t.logoUrl}
                      alt={t.symbol}
                      width={18}
                      height={18}
                      className="shrink-0 rounded-full"
                    />
                  )}
                  {t.symbol}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">
          Recipient Address
        </Label>
        <Input
          value={values.toAddress}
          onChange={(e) => onChange({ ...values, toAddress: e.target.value })}
          placeholder={addressPlaceholder}
          className={`border-border bg-secondary font-mono text-xs ${addressError ? "border-destructive focus-visible:ring-destructive" : ""}`}
        />
        {addressError && (
          <p className="text-[11px] leading-tight text-destructive">
            {addressError}
          </p>
        )}
      </div>

      {showAmount && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Amount</Label>
          <Input
            value={values.toUnits}
            onChange={(e) => onChange({ ...values, toUnits: e.target.value })}
            placeholder="e.g. 1.00"
            className="border-border bg-secondary"
          />
          <p className="text-[11px] leading-tight text-muted-foreground/70">
            Human-readable amount (e.g. 1 = 1 USDC). The SDK handles decimals.
          </p>
        </div>
      )}
    </div>
  )
}
