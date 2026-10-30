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
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
}

export default nextConfig
