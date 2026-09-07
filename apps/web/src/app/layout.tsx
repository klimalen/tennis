import type { Metadata } from 'next'
import { Bebas_Neue, Anton, DM_Sans, Playfair_Display } from 'next/font/google'
import './globals.css'

const bebasNeue = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
})

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-anton',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const playfair = Playfair_Display({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Tennis — Find players, book courts, play.',
  description: 'The social operating system for racket sports.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bebasNeue.variable} ${anton.variable} ${dmSans.variable} ${playfair.variable}`}>
      <body className="min-h-screen bg-brand-bg text-[#1a1a1a] font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
