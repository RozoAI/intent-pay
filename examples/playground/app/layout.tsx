import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PlaygroundNav } from "@/components/PlaygroundNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import pkg from "../package.json";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const fontMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Rozo Pay Playground",
  description: "Interactive developer playground for @rozoai/intent-pay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const payVersion = pkg.dependencies["@rozoai/intent-pay"];
  const commonVersion = pkg.dependencies["@rozoai/intent-common"];

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, geist.variable)}
    >
      <body>
        <Providers>
          <div className="min-h-screen bg-background flex flex-col">
            <header className="border-b border-border px-6 py-3 shrink-0">
              <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
                <h1 className="text-sm font-semibold text-foreground">
                  Rozo Pay Playground
                </h1>
                <Separator orientation="vertical" className="h-4 shrink-0" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground font-mono">
                    intent-pay{" "}
                    <span className="text-foreground/60">{payVersion}</span>
                  </span>
                  <span className="text-xs text-muted-foreground/50">·</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    intent-common{" "}
                    <span className="text-foreground/60">{commonVersion}</span>
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <a
                    href="https://docs.rozo.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    Docs ↗
                  </a>
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="max-w-7xl w-full mx-auto px-6 py-6 flex-1">
              <PlaygroundNav />
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
