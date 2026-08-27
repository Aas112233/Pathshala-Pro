import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // We need to mark Prisma as external so the edge logic works correctly
  serverExternalPackages: ["@prisma/client"],
  // Optimize heavy package imports for blazing fast compilation and small bundle footprints
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-select",
      "@tanstack/react-table",
      "@tanstack/react-query",
      "date-fns",
    ],
  },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 31536000,
  },
  // Disable ESLint during build to avoid memory issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: undefined,
};

export default withNextIntl(nextConfig);
