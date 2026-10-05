import Link from 'next/link'

/**
 * Single-viewport welcome for the native WebView only.
 * Web marketing page stays at `/` for browsers and Google's brand check.
 */
export function NativeWelcome() {
  return (
    <div className="native-welcome relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-brand-bg text-[#1a1a1a]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[38%] bg-[#1E3A6E]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 top-[16%] h-52 w-52 rounded-full bg-[#E8748A]/35 blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-[26%] h-44 w-44 rounded-full bg-[#3A8A7A]/30 blur-2xl"
      />

      <div className="relative flex min-h-0 flex-1 flex-col px-6 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-[max(1rem,var(--app-safe-top,0px))]">
        <header className="native-welcome-in shrink-0 pt-1">
          <p className="font-display text-[2.75rem] tracking-widest text-[#F0EBE3] sm:text-5xl">
            GAME<span className="-ml-[0.2em] tracking-normal">.</span>
          </p>
          <p className="mt-1.5 text-[10px] tracking-[0.28em] uppercase text-[#D4E040]">
            Find · Play · Connect
          </p>
        </header>

        <main className="native-welcome-in native-welcome-in-delay mt-auto flex min-h-0 flex-col justify-end">
          <h1 className="max-w-[12ch] font-display text-[clamp(2.6rem,12vw,3.5rem)] leading-[0.9] tracking-wide text-[#1a1a1a]">
            FIND A GAME NEAR YOU
          </h1>
          <p className="mt-3 max-w-[22ch] font-fraunces text-lg italic leading-snug text-[#497250] sm:text-xl">
            A partner, an open court, this week
          </p>
          <p className="native-welcome-extra mt-3 max-w-[28ch] text-[13px] leading-relaxed text-[rgba(26,26,26,0.62)]">
            See who plays nearby, take a free seat, and message after you match. Free to join.
          </p>
        </main>

        <footer className="native-welcome-in native-welcome-in-delay-2 mt-5 shrink-0 space-y-2.5">
          <Link
            href="/sign-up"
            className="flex w-full items-center justify-center rounded-full bg-[#E8748A] px-6 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a] transition-colors active:bg-[#E8406A]"
          >
            Create free account
          </Link>
          <Link
            href="/sign-in"
            className="flex w-full items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white px-6 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-[#1a1a1a] transition-colors active:bg-[#F4F1EC]"
          >
            I already have an account
          </Link>
          <p className="pt-0.5 text-center text-[11px] leading-relaxed text-[rgba(26,26,26,0.42)]">
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy
            </Link>
            {' · '}
            <Link href="/terms" className="underline underline-offset-2">
              Terms
            </Link>
          </p>
        </footer>
      </div>
    </div>
  )
}
