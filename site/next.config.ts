import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The site reads ../docs, ../CHANGELOG.md and ../README.md at build time.
  outputFileTracingRoot: path.join(import.meta.dirname, ".."),
  turbopack: { root: path.join(import.meta.dirname, "..") },
  images: { formats: ["image/avif", "image/webp"] },
  experimental: { optimizePackageImports: ["@react-three/drei"] },
};

export default withNextIntl(config);
