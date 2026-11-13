import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@tennis/shared'],
  // Next 15 defaults dynamic staleTime to 0 — every tab switch refetches RSC.
  // Keep a short client cache so revisiting Discover/ME/Chats feels instant;
  // loading.tsx still covers the cold path.
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
  images: {
    // Default imageSizes omit common avatar widths (36/40/44/56/72/80).
    // next/image then requests e.g. w=80 and Vercel returns 400 — broken avatars.
    imageSizes: [16, 32, 36, 40, 44, 48, 56, 64, 72, 80, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'xyqubkrkmhqzwjqkqhzh.supabase.co' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
}

export default nextConfig
