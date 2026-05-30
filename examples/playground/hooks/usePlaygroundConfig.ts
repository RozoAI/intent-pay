"use client";

import { useCallback, useEffect, useState } from "react";

export function usePlaygroundConfig<T>(
  key: string,
  defaults: T,
): [T, (value: T) => void] {
  const [config, setConfigState] = useState<T>(defaults);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        setConfigState(JSON.parse(raw) as T);
      }
    } catch {
      // corrupted storage — fall back to defaults
    }
  }, [key]);

  const setConfig = useCallback(
    (value: T) => {
      setConfigState(value);
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        // storage full or unavailable — ignore
      }
    },
    [key],
  );

  return [config, setConfig];
}
