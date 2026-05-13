"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const Providers = dynamic(
  () => import("./providers").then((mod) => ({ default: mod.Providers })),
  { ssr: false }
);

export function ProvidersWrapper({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
