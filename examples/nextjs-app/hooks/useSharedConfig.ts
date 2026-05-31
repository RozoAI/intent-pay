"use client";

import { useCallback, useEffect, useState } from "react";

export interface SharedConfig {
  toChain: number;
  toToken: string;
  toAddress: string;
  toUnits: string;
}

const STORAGE_KEY = "playground-config";

const DEFAULTS: SharedConfig = {
  toChain: 8453,
  toToken: "",
  toAddress: "",
  toUnits: "",
};

function loadFromStorage(): SharedConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SharedConfig>) };
  } catch {
    // corrupted — fall back to defaults
  }
  return DEFAULTS;
}

export function useSharedConfig(): [SharedConfig, (value: SharedConfig) => void, boolean] {
  const [config, setConfigState] = useState<SharedConfig>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigState(loadFromStorage());
      setHydrated(true);
    }
  }, [hydrated]);

  const setConfig = useCallback((value: SharedConfig) => {
    setConfigState(value);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      // storage unavailable — ignore
    }
  }, []);

  return [config, setConfig, hydrated];
}
