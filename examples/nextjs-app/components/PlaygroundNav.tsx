"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/bridge", label: "Bridge" },
  { href: "/checkout", label: "Online Checkout" },
  { href: "/card", label: "Card" },
  { href: "/deposit", label: "Wallet Deposit" },
];

export function PlaygroundNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-border mb-6">
      {tabs.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "px-4 py-2 text-sm font-medium transition-colors duration-150 border-b-2 -mb-px",
            pathname === href
              ? "border-foreground text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
