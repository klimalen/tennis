import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'GAME. — Find and Play Tennis',
    short_name: 'GAME.',
    description: 'Find and play tennis. Players, games, courts, and more.',
    start_url: '/search',
    scope: '/',
    display: 'standalone',
    launch_handler: {
      client_mode: ['focus-existing', 'auto'],
    },
    background_color: '#FAF7F2',
    theme_color: '#FAF7F2',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
