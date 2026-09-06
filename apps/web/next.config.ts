import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@tennis/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.cloudflare.com' },
    ],
  },
}

export default nextConfig
