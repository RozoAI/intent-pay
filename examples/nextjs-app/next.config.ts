import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // React StrictMode's dev-only effect double-invoke (setup → cleanup → setup)
  // cancels the SDK's auto-transfer timer in PayWithToken: the first effect run
  // schedules the 100ms transfer timeout and sets `autoTransferOrderRef`, the
  // StrictMode cleanup clears that timeout, and the second run returns early on
  // the now-set ref — so the wallet request is never made. Disabled here so the
  // E2E (and local dev) exercise the same single-invoke path as a production
  // build. Remove once the SDK effect is StrictMode-safe.
  reactStrictMode: false,
  transpilePackages: ["@rozoai/intent-pay"],
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/:path*.css",
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ]
  },
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
