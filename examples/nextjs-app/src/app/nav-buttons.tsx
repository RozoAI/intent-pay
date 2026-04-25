"use client";

import { version } from "@rozoai/intent-pay";
import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heading } from "../shared/tailwind-catalyst/heading";

export default function NavButtons() {
  const pathname = usePathname();

  const Btn = ({ route, children }: { route: string; children: string }) => {
    const isActive = pathname === route;

    return (
      <Link
        href={route}
        aria-current={isActive ? "page" : undefined}
        className={clsx(
          "inline-flex min-h-10 items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary-dark text-white hover:bg-primary-medium"
            : "border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50",
        )}
      >
        {children}
      </Link>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 border-b border-gray-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-primary-medium">
            Example App
          </div>
          <Heading className="text-2xl font-semibold tracking-tight text-primary-dark sm:text-3xl">
            RozoPayButton Examples
          </Heading>
          <div className="text-sm text-gray-500">
            Developer-facing examples for testing payment flows and config
            behavior.
          </div>
        </div>

        <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-600">
          @rozoai/intent-pay <span className="font-medium">v{version}</span>
        </div>
      </div>

      <nav
        aria-label="Example pages"
        className="flex flex-wrap items-center gap-3"
      >
        <Btn route="/basic">Basic</Btn>
        {/* <Btn route="/contract">Contract</Btn> */}
        <Btn route="/checkout">Checkout</Btn>
        <Btn route="/deposit">Deposit</Btn>
        <Btn route="/props">Props</Btn>
        {/* <Btn route="/mini-app">Mini App</Btn> */}
      </nav>
    </div>
  );
}
