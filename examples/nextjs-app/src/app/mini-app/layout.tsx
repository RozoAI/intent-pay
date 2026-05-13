import type { Metadata } from "next";
import { type ReactNode } from "react";
import { ProvidersWrapper } from "./providers-wrapper";

import "../../styles/tailwind.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rozo Pay Farcaster Frame Demo",
  description: "Demo embedding Rozo Pay in a Farcaster Framev2",
};

export default function RootLayout(props: { children: ReactNode }) {
  return <ProvidersWrapper>{props.children}</ProvidersWrapper>;
}
