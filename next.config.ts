import type { NextConfig } from "next";

const nextConfig: any = {
  typescript: {
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },

  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
