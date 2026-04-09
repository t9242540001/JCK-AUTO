import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
