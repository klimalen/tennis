import Link from 'next/link'

const appName = 'GAME. — Find and Play Tennis'

export default function RootPage() {
  return (
    <div className="min-h-screen bg-brand-bg text-[#1a1a1a]">
      <main className="mx-auto max-w-lg px-5 py-16">
        <h1 className="font-sans text-3xl font-semibold leading-tight">
          {appName}
        </h1>
        <p className="mt-4 font-fraunces text-lg italic text-[#497250]">
          A place to find a tennis partner near you
        </p>

        <section className="mt-8 space-y-3 text-sm leading-relaxed text-[rgba(26,26,26,0.75)]">
          <h2 className="font-sans text-base font-semibold text-[#1a1a1a]">What this app is for</h2>
          <p>
            {appName} is a tennis app. It helps people find a partner, join an open game, and see public courts. This page is public. You can read it without an account and without signing in.
          </p>
          <p>
            You can look through players, games, and courts before you create an account. An account is only for saving a profile, sending a message, and joining a game.
          </p>
          <p>
            {appName} does not generate images. It does not use Google APIs to create pictures, including non-consensual intimate imagery. The only Google service it uses is Sign in with Google, and only to open an account with your name, email address, and profile photo.
          </p>
        </section>

        <ul className="mt-6 space-y-2 text-sm text-[#1a1a1a]">
          <li>Find players in your city</li>
          <li>Join or host an open game</li>
          <li>See public courts</li>
          <li>Message someone about a game</li>
        </ul>

        <div className="mt-8">
          <Link
            href="/search"
            className="inline-block rounded-full bg-[#E8748A] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]"
          >
            Look around
          </Link>
          <p className="mt-4 text-sm text-[rgba(26,26,26,0.55)]">
            <Link href="/sign-up" className="underline underline-offset-2 text-[#1a1a1a]">Create an account</Link>
            {' or '}
            <Link href="/sign-in" className="underline underline-offset-2 text-[#1a1a1a]">sign in</Link>
            {' if you already have one.'}
          </p>
        </div>

        <p className="mt-10 text-sm text-[rgba(26,26,26,0.55)]">
          <Link href="https://www.game-tennis.space/privacy" className="underline underline-offset-2 text-[#1a1a1a]">Privacy Policy</Link>
          {' · '}
          <Link href="https://www.game-tennis.space/terms" className="underline underline-offset-2 text-[#1a1a1a]">Terms of Use</Link>
        </p>
      </main>
    </div>
  )
}
