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
  // - qualities: allowlist of `quality` prop values. 75 — Next.js default,
  //   85 — our Hero. q= outside the list returns 400 Bad Request. REQUIRED
  //   field starting in Next.js 16 (security: DoS prevention via arbitrary q=).
  // - localPatterns: allowlist of paths for local <Image src="/..."/>.
  //   Without it Next.js 16 may 400 on paths with query strings or
  //   unexpected formats. Closes the attack surface of /_next/image
  //   over arbitrary local paths. Два источника: /images/** для
  //   статических ассетов, /storage/** для динамических (фото каталога
  //   через симлинк public/storage → /var/www/jckauto/storage).
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400,
    qualities: [75, 85],
    localPatterns: [
      {
        pathname: '/images/**',
        search: '',
      },
      {
        pathname: '/storage/**',
        search: '',
      },
    ],
    // External Encar.com photo CDN. Single host, /pic*/ paths.
    // Used by /tools/encar hero photo + lightbox. Server-side fetch
    // by Next.js Image Optimizer — no client CORS dependency. Cached
    // for 86400s on VDS per minimumCacheTTL above.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'ci.encar.com',
        pathname: '/**',
      },
    ],
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
