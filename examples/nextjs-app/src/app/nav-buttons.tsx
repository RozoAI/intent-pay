"use client";

import { version } from "@rozoai/intent-pay";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "../shared/tailwind-catalyst/button";
import { Heading } from "../shared/tailwind-catalyst/heading";

export default function NavButtons() {
  const pathname = usePathname();

  const Btn = ({ route, children }: { route: string; children: string }) => (
    <Link href={route}>
      {pathname === route ? (
        <Button className="inline-flex px-4 py-2 rounded-md bg-primary-dark hover:bg-primary-medium text-white transition-colors">
          {children}
        </Button>
      ) : (
        <Button
          outline
          className="inline-flex px-4 py-2 rounded-md border border-primary-dark text-primary-dark "
        >
          {children}
        </Button>
      )}
    </Link>
  );

  return (
    <>
      <Heading className="text-primary-dark">RozoPayButton Examples</Heading>
      <div className="mt-1 text-sm text-primary-medium">
        @rozoai/intent-pay v{version}
      </div>

      <div className="flex flex-wrap gap-4 mt-10">
        <Btn route="/basic">Basic</Btn>
        <Btn route="/contract">Contract</Btn>
        <Btn route="/checkout">Checkout</Btn>
        <Btn route="/deposit">Deposit</Btn>
        <Btn route="/mini-app">Mini App</Btn>
      </div>
    </>
  );
}
