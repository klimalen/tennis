import type { Metadata } from 'next'
import { Oswald, Anton, Source_Sans_3, Fraunces } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'Tennis — Find players, book courts, play.',
  description: 'The social operating system for racket sports.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${anton.variable} ${sourceSans.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-brand-bg text-[#1a1a1a] font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
