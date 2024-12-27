import json from "@rollup/plugin-json";
import dts from "rollup-plugin-dts";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import typescript from "rollup-plugin-typescript2";

/** @type {import('rollup').RollupOptions[]} */
export default [
  // Build bundle: index.js
  {
    input: ["./src/index.ts"],
    external: ["react", "react-dom", "framer-motion", "wagmi"],
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
        useTsconfigDeclarationDir: true,
        exclude: "node_modules/**",
      }),
    ],
  },
  // Build types: index.d.ts
  {
    input: "./build/packages/paykit/packages/connectkit/src/index.d.ts",
    output: { file: "build/index.d.ts", format: "esm" },
    plugins: [
      dts({
        compilerOptions: {
          preserveValueImports: false,
        },
      }),
    ],
  },
];
