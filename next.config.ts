import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow connecting to any AgentHub server
  async rewrites() {
    return [];
  },
};

export default nextConfig;
