import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // We need to mark Prisma as external so the edge logic works correctly
  serverExternalPackages: ["@prisma/client"],
  // Disable ESLint during build to avoid memory issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Output standalone for Cloudflare Workers
  output: "standalone",
};

export default withNextIntl(nextConfig);
