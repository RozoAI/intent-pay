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
    }
    return config
  },
}

export default nextConfig
