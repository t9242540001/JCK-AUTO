import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['pdfkit'],
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
  async redirects() {
    return [
      {
        source: '/calculator',
        destination: '/tools/calculator',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
