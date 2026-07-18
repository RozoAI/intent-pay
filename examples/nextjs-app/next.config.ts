import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  transpilePackages: ["@rozoai/intent-pay"],
  webpack: (config) => {
    // Force single wagmi instance across workspace symlink by pointing to the
    // app's own node_modules copy so SDK and app share the same context registry.
    const wagmiPkg = require.resolve("wagmi/package.json")
    const wagmiDir = wagmiPkg.replace("/package.json", "")
    config.resolve.alias = {
      ...config.resolve.alias,
      wagmi: wagmiDir,
      // @coinbase/cdp-sdk (transitive via @wagmi/connectors baseAccount) imports
      // @x402/* packages that aren't installed — stub them since we don't use
      // the x402 payment flow.
      "@x402/evm/upto/client": false,
      "@x402/evm/exact/client": false,
      "@x402/core/client": false,
      "@x402/svm/exact/client": false,
      "@x402/evm": false,
    }
    return config
  },
}

export default nextConfig
