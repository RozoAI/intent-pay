"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSupportedChains, getTokensForChain } from "@/lib/chains";
import { useEffect, useMemo } from "react";

export interface ParamFormValues {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
}

interface ParamFormProps {
  values: ParamFormValues;
  onChange: (values: ParamFormValues) => void;
  showAmount?: boolean;
}

const chains = getSupportedChains();

export function ParamForm({
  values,
  onChange,
  showAmount = true,
}: ParamFormProps) {
  const tokens = useMemo(
    () => getTokensForChain(values.toChain),
    [values.toChain],
  );

  // Reset token when chain changes and current token not available on new chain
  useEffect(() => {
    const tokenExists = tokens.some((t) => t.token === values.toToken);
    if (!tokenExists && tokens.length > 0) {
      onChange({ ...values, toToken: tokens[0].token });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens]);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Destination Chain</Label>
        <Select
          value={String(values.toChain)}
          onValueChange={(v) =>
            onChange({ ...values, toChain: Number(v), toToken: "" })
          }
        >
          <SelectTrigger className="w-full bg-secondary border-border">
            <SelectValue placeholder="Select chain" />
          </SelectTrigger>
          <SelectContent>
            {chains.map((c) => (
              <SelectItem key={c.chainId} value={String(c.chainId)}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Destination Token</Label>
        <Select
          value={values.toToken}
          onValueChange={(v) => onChange({ ...values, toToken: v })}
          disabled={tokens.length === 0}
        >
          <SelectTrigger className="w-full bg-secondary border-border">
            <SelectValue placeholder="Select token" />
          </SelectTrigger>
          <SelectContent>
            {tokens.map((t) => (
              <SelectItem key={t.token} value={t.token}>
                {t.symbol}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Recipient Address</Label>
        <Input
          value={values.toAddress}
          onChange={(e) => onChange({ ...values, toAddress: e.target.value })}
          placeholder="0x… or Solana/Stellar address"
          className="bg-secondary border-border font-mono text-xs"
        />
      </div>

      {showAmount && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Amount (e.g. &quot;1&quot; = 1 USDC)
          </Label>
          <Input
            value={values.toUnits}
            onChange={(e) => onChange({ ...values, toUnits: e.target.value })}
            placeholder="1.00"
            className="bg-secondary border-border"
          />
        </div>
      )}
    </div>
  );
}
