import { PlaygroundNav } from "@/components/PlaygroundNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import pkg from "../package.json";
import "./globals.css";
import { Providers } from "./providers";

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
                <Image src="/rozo-logo.png" width={25} height={25} alt="rozo" className="size-8" />
                <h1 className="text-sm font-semibold text-foreground">
                  Rozo Intent SDK Playground
                </h1>
                <div className="ml-auto flex items-center gap-2">
                  <a
                    href="https://docs.rozo.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    <span>Docs</span> <ExternalLink size={14} />
                  </a>
                  <Separator orientation="vertical" className="h-6 ml-2" />
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="max-w-7xl w-full mx-auto px-6 py-6 flex-1">
              <PlaygroundNav />
              {children}

              <footer className="flex items-start gap-3 mt-8 w-full">
                <div className="flex flex-col items-start gap-2 flex-wrap">
                  <Link href="https://www.npmjs.com/package/@rozoai/intent-pay" target="_blank" className="text-xs text-muted-foreground font-mono tracking-wide hover:underline hover:font-bold">
                    @rozoai/intent-pay@
                    <span className="text-foreground/60 font-bold">{payVersion}</span>
                  </Link>
                  <Link href="https://www.npmjs.com/package/@rozoai/intent-common" target="_blank" className="text-xs text-muted-foreground font-mono tracking-wide hover:underline hover:font-bold">
                    @rozoai/intent-common@
                    <span className="text-foreground/60 font-bold">{commonVersion}</span>
                  </Link>
                </div>

                <Link href="https://github.com/rozoAI/intent-pay" target="_blank" className="ml-auto">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path  className="dark:fill-white" d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg>
                </Link>
              </footer>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
