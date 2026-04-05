import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["geist"],
  // Allow importing shared app registries (model + provider lists) from ../lib
  experimental: { externalDir: true },
};

export default nextConfig;
