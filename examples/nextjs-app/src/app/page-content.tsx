"use client";

import Link from "next/link";
import { Container } from "./shared";

interface DemoCard {
  title: string;
  description: string;
  path: string;
}

const demos: DemoCard[] = [
  {
    title: "Basic Payment",
    description: "Accept basic payments from any coin on any chain.",
    path: "/basic",
  },
  {
    title: "Checkout Flow",
    description:
      "Deliver a great checkout experience with customizable payment options.",
    path: "/checkout",
  },
  // {
  //   title: "Smart Contract",
  //   description:
  //     "Skip bridges, swaps and approvals. Let your users transact in one step.",
  //   path: "/contract",
  // },
  {
    title: "Deposit Demo",
    description:
      "Onboard users from any chain, any exchange, any coin into your app.",
    path: "/deposit",
  },
  /* {
    title: "Mini App",
    description: "Ship World and Farcaster mini apps with social distribution.",
    path: "/mini-app",
  }, */
];

export function DemoPageContent() {
  return (
    <Container>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)] lg:items-end">
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-medium">
              Developer demo suite
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-primary-dark sm:text-4xl">
              Rozo Pay Integration Demos
            </h1>
            <p className="max-w-2xl text-base leading-7 text-gray-600">
              Minimal, developer-focused examples. Each demo includes a live
              flow plus copyable integration code.
            </p>
          </div>
        </header>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">
            Scenarios
          </h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {demos.map((demo) => (
              <article
                key={demo.path}
                className="group rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-colors hover:border-gray-300 flex flex-col"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {demo.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600">
                      {demo.description}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex items-center justify-between">
                  <Link
                    href={demo.path}
                    aria-label={`Open ${demo.title} demo`}
                    className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary-dark px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-medium"
                  >
                    Open
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </Container>
  );
}
