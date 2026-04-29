import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  serverExternalPackages: ['pdfkit'],
  typescript: { ignoreBuildErrors: true },
  // Image optimizer configuration:
  // - formats: AVIF priority (~50% smaller than JPEG), WebP fallback.
  // - deviceSizes: 360 and 414 added for mobile breakpoints (Next.js
  //   defaults exclude them; Russian mobile traffic is 30-42%).
  // - imageSizes: Next.js defaults, listed explicitly for clarity.
  // - minimumCacheTTL: 24h cache on optimized variants.
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
  },
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
