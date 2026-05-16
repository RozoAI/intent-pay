import type { Metadata } from "next";
import { type ReactNode } from "react";
import { ProvidersWrapper } from "./providers-wrapper";

import "../../styles/tailwind.css";

export const metadata: Metadata = {
  title: "Rozo Pay Checkout Demo",
  description: "Demo showcasing checkout ID correlation",
};

export default function RootLayout(props: { children: ReactNode }) {
  return <ProvidersWrapper>{props.children}</ProvidersWrapper>;
}
