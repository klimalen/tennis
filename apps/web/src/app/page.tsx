import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const appName = 'GAME. — Find and Play Tennis'

export default async function RootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/search')

  return (
    <div className="min-h-screen bg-brand-bg text-[#1a1a1a]">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-16">
        <p className="text-[10px] tracking-[0.28em] uppercase text-[#85648F]">✦ GAME.</p>
        <h1 className="mt-3 font-sans text-3xl font-semibold leading-tight">
          {appName}
        </h1>
        <p className="mt-4 font-fraunces text-lg italic text-[#497250]">
          A place to find a tennis partner near you
        </p>
        <div className="mt-8 space-y-3 text-sm leading-relaxed text-[rgba(26,26,26,0.75)]">
          <p>
            {appName} helps people find a tennis partner, join an open game, and see courts nearby. You can look around without an account. An account is only for saving a profile, chatting, and joining a game.
          </p>
          <p>
            The app does not generate images. It does not use a Google account to create pictures or any other content. If you sign in with Google, we receive your name, email address, and profile photo, and we use them only to open your account.
          </p>
        </div>
        <ul className="mt-6 space-y-2 text-sm text-[#1a1a1a]">
          <li>Find players in your city</li>
          <li>Join or host an open game</li>
          <li>See public courts</li>
          <li>Message someone about a game</li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-full bg-[#E8748A] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]"
          >
            Create account
          </Link>
          <Link
            href="/sign-in"
            className="rounded-full border border-[#1a1a1a]/20 bg-white px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-brand-field"
          >
            Sign in
          </Link>
          <Link
            href="/search"
            className="rounded-full px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.16em] text-[#1E3A6E] hover:underline"
          >
            Look around
          </Link>
        </div>
        <p className="mt-10 text-sm text-[rgba(26,26,26,0.55)]">
          <Link href="/privacy" className="underline underline-offset-2 text-[#1a1a1a]">Privacy Policy</Link>
          {' · '}
          <Link href="/terms" className="underline underline-offset-2 text-[#1a1a1a]">Terms of Use</Link>
        </p>
      </main>
    </div>
  )
}
