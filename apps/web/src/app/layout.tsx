import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Oswald, Anton, Source_Sans_3, Fraunces } from 'next/font/google'
import { PwaRegister } from '@/components/pwa/PwaRegister'
import { isNativeGameAppUa } from '@/lib/native-app'
import './globals.css'

const bebasNeue = Oswald({
  weight: '600',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-bebas',
  display: 'swap',
})

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
})

const sourceSans = Source_Sans_3({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  style: ['normal', 'italic'],
  variable: '--font-sans',
  display: 'swap',
})

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
})

const siteUrl = 'https://www.game-tennis.space'

const siteName = 'GAME. — Find and Play Tennis'
const siteTitle = 'GAME. — Find and Play Tennis'
const siteDescription = 'Find and play tennis. Players, games, courts, and more.'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: siteTitle,
  description: siteDescription,
  applicationName: siteName,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: siteUrl,
    siteName,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: 'default',
  },
}

export const viewport: Viewport = {
  themeColor: '#FAF7F2',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const native = isNativeGameAppUa((await headers()).get('user-agent'))
  const htmlClass = [
    bebasNeue.variable,
    anton.variable,
    sourceSans.variable,
    fraunces.variable,
    native ? 'game-native' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <html lang="en" className={htmlClass}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-brand-bg text-[#1a1a1a] font-sans antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  )
}
