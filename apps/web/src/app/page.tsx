import Link from 'next/link'
import { Calendar, MapPin, Users } from 'lucide-react'

const appName = 'GAME. — Find and Play Tennis'

const ways = [
  { title: 'Players', line: 'See who plays in your city', icon: Users },
  { title: 'Open games', line: 'Take a free seat this week', icon: Calendar },
  { title: 'Courts', line: 'Find a place to hit', icon: MapPin },
]

export default function RootPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-[#1a1a1a]">
      <main className="mx-auto max-w-3xl px-5 pb-24 pt-14 sm:pt-20">
        <p className="text-[10px] tracking-[0.28em] uppercase text-[#85648F]">✦ GAME.</p>
        <h1 className="mt-4 max-w-xl font-display text-6xl leading-[0.88] tracking-wide sm:text-8xl">
          FIND A GAME
        </h1>
        <p className="mt-4 font-fraunces text-xl italic text-[#497250] sm:text-2xl">
          A partner near you, this week
        </p>
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-[rgba(26,26,26,0.72)]">
          {appName} is where you find a player, join an open game, and see public courts.
        </p>

        <div className="mt-8">
          <Link
            href="/search"
            className="inline-block rounded-full bg-[#E8748A] px-6 py-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]"
          >
            Find a game
          </Link>
        </div>

        <ul className="mt-12 grid gap-3 sm:grid-cols-3">
          {ways.map((way) => (
            <li key={way.title}>
              <Link
                href="/search"
                className="block h-full rounded-[28px] bg-white px-5 py-5 transition-colors hover:bg-[#F4F1EC]"
              >
                <way.icon size={18} className="text-[#3A8A7A]" aria-hidden />
                <p className="mt-4 font-display text-3xl tracking-wide uppercase">{way.title}</p>
                <p className="mt-1 text-sm text-[rgba(26,26,26,0.6)]">{way.line}</p>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-3 rounded-[28px] bg-[#1E3A6E] px-6 py-7 text-[#F0EBE3]">
          <p className="font-display text-4xl leading-none tracking-wide">THEN TAKE A SEAT</p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-[#F0EBE3]/85">
            An account is for a profile, a message, and a place in the game
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link
              href="/sign-up"
              className="rounded-full bg-[#E8748A] px-6 py-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]"
            >
              Create an account
            </Link>
            <Link
              href="/sign-in"
              className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#F0EBE3] underline underline-offset-4"
            >
              Sign in
            </Link>
          </div>
        </section>

        <footer className="mt-10 max-w-xl space-y-3 text-[13px] leading-relaxed text-[rgba(26,26,26,0.5)]">
          <p>
            This page is public. You can read it without signing in. {appName} does not generate images. Sign in with Google only opens your account with your name, email address, and profile photo.
          </p>
          <p>
            <Link href="https://www.game-tennis.space/privacy" className="underline underline-offset-2 text-[#1a1a1a]">
              Privacy Policy
            </Link>
            {' · '}
            <Link href="https://www.game-tennis.space/terms" className="underline underline-offset-2 text-[#1a1a1a]">
              Terms of Use
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
