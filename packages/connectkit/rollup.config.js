import json from "@rollup/plugin-json";
import typescript from "@rollup/plugin-typescript";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import { visualizer } from "rollup-plugin-visualizer";

/** @type {import('rollup').RollupOptions[]} */
export default [
  // Build a folder of files for better tree-shaking
  {
    input: ["./src/index.ts", "./src/world.ts"],
    external: [
      "@creit.tech/stellar-wallets-kit",
      "@reown/appkit",
      "@reown/appkit/networks",
      "@rozoai/intent-common",
      "@solana/spl-token",
      "@solana/wallet-adapter-base",
      "@solana/wallet-adapter-react",
      "@solana/web3.js",
      "@stellar/stellar-sdk",
      "@trpc/client",
      "@wagmi/connectors",
      "@walletconnect/sign-client",
      "@worldcoin/minikit-js",
      "bs58",
      "buffer",
      "detect-browser",
      "framer-motion",
      "pino-pretty",
      "qrcode",
      "react-dom",
      "react-transition-state",
      "react-use-measure",
      "resize-observer-polyfill",
      "styled-components",
      "wagmi",
      "react",
    ],
    output: [
      {
        dir: "build",
        format: "esm",
        sourcemap: true,
        preserveModules: true,
      },
    ],
    plugins: [
      peerDepsExternal(),
      json(),
      typescript({
        declaration: true,
        declarationDir: "build",
        rootDir: "src",
      }),

      visualizer({
        filename: "bundle-analysis.html",
        gzipSize: true,
        brotliSize: true,
      }),
    ],
  },
];
