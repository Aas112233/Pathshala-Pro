import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // We need to mark Prisma as external so the edge logic works correctly
  serverExternalPackages: ["@prisma/client"],
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default withNextIntl(nextConfig);
