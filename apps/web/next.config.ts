import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ["@care/domain", "@care/ui"],
};

export default nextConfig;
