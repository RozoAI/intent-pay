"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

// Load the wallet providers only on the client to avoid SSR issues with
// wallet SDKs that touch `localStorage` or other browser-only APIs at module
// import time.
const Providers = dynamic(
  () => import("./providers").then((mod) => ({ default: mod.Providers })),
  { ssr: false }
);

export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
