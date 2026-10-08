import Link from 'next/link'

const appName = 'GAME. — Find and Play Tennis'

const players = [
  {
    name: 'Mike',
    level: 'Beginner',
    about: 'Singles · Weekends',
    more: 'First matches',
    face: 'bg-[#111111] text-[#f4efe9]',
    chip: 'bg-[#E8E1D7] text-[#111111]',
  },
  {
    name: 'Sarah',
    level: 'Intermediate',
    about: 'Singles / Doubles',
    more: 'Evenings after work',
    face: 'bg-[#3A8A7A] text-[#F0EBE3]',
    chip: 'bg-[#3A8A7A] text-[#F0EBE3]',
  },
  {
    name: 'Alex',
    level: 'Advanced',
    about: 'Singles · Early mornings',
    more: 'Match play',
    face: 'bg-[#E8748A] text-[#111111]',
    chip: 'bg-[#E8748A] text-[#111111]',
  },
  {
    name: 'Jordan',
    level: 'Competitive',
    about: 'Doubles · Weekends',
    more: 'Serious sets',
    face: 'bg-[#1E3A6E] text-[#F0EBE3]',
    chip: 'bg-[#D4A017] text-[#1E3A6E]',
  },
]

const games = [
  {
    level: 'Intermediate',
    time: 'Thu · 7:00 PM',
    place: 'Tennis court Champion',
    detail: 'Singles · Best of 3',
    seats: '1 seat left',
    featured: true,
  },
  {
    level: 'Advanced',
    time: 'Sat · 10:00 AM',
    place: 'Tennis Club',
    detail: 'Doubles · Social match',
    seats: '2 seats left',
    featured: false,
  },
  {
    level: 'Beginner',
    time: 'Sun · 5:30 PM',
    place: 'Court 4',
    detail: 'Singles · Casual',
    seats: 'Open',
    featured: false,
  },
]

const courts = [
  { name: 'Tennis court Champion', sub: '4 courts · Indoor', tone: 'bg-[#25457f]' },
  { name: 'Court 4', sub: '4 courts · Clay', tone: 'bg-[#4f775d]' },
  { name: 'The Evening Set', sub: '3 courts · Outdoor', tone: 'bg-[#ef6d87]' },
]

function CourtThumb({ tone }: { tone: string }) {
  return (
    <div className={`relative h-[92px] overflow-hidden rounded-[18px] ${tone}`}>
      <div className="absolute inset-y-2 left-1/2 w-0.5 -translate-x-1/2 bg-white/75" />
      <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 bg-white/75" />
    </div>
  )
}

export function WebLanding() {
  return (
    <div className="overflow-x-clip bg-[#f4efe9] text-[#111111] scroll-smooth">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-[34px]">
        <header className="flex items-center justify-between py-6">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.34em]">✦ GAME.</p>
          <nav className="flex items-center gap-7 text-[13px]">
            <a href="#games" className="hidden text-[#111111] no-underline md:inline">Games</a>
            <a href="#players" className="hidden text-[#111111] no-underline md:inline">Players</a>
            <a href="#courts" className="hidden text-[#111111] no-underline md:inline">Courts</a>
            <Link href="/sign-in" className="border-b border-[#111111] pb-0.5 text-[#111111] no-underline">
              Sign in
            </Link>
          </nav>
        </header>

        <section className="relative grid items-center gap-10 pb-16 pt-6 lg:min-h-[670px] lg:grid-cols-[1.1fr_0.9fr] lg:gap-[54px] lg:pb-[86px] lg:pt-[54px]">
          <div aria-hidden className="pointer-events-none absolute -right-[170px] top-[34px] -z-10 h-[430px] w-[430px] rounded-full bg-[#c7ee6a]" />
          <div>
            <p className="mb-[22px] text-[11px] font-extrabold uppercase tracking-[0.32em] text-[#896e93]">
              This week
            </p>
            <h1 className="m-0 font-display text-[64px] uppercase leading-[0.82] tracking-wide sm:text-[86px] lg:text-[118px]">
              Find <span className="mx-[5px] inline-block -rotate-[7deg] text-[#ef6d87]">/</span>
              <br />
              Play
            </h1>
            <p className="mt-6 max-w-[650px] font-fraunces text-2xl italic leading-snug text-[#4f775d] sm:text-[30px]">
              Find a partner, join a game, discover a court — and get on court this week
            </p>
            <p className="mt-6 max-w-[610px] text-base leading-relaxed text-[#77716c]">
              {appName} brings players, open games, and public courts into one place. Look through the examples here. Create an account when you want the real ones.
            </p>
            <div className="mt-7 flex flex-wrap gap-[13px]">
              <Link href="/sign-up" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#ef6d87] px-6 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#111111] no-underline">
                Create account
              </Link>
              <Link href="/sign-in" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#b9afa8] bg-white/20 px-6 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#111111] no-underline">
                Sign in
              </Link>
            </div>
          </div>

          <div className="relative min-h-[450px] sm:min-h-[520px] lg:min-h-[500px]">
            <article className="absolute right-0 top-2 w-[290px] rotate-[5deg] rounded-[28px] bg-[#25457f] p-6 text-white shadow-[0_22px_55px_rgba(19,33,67,0.18)] sm:right-5 sm:w-[360px]">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">Open game</p>
              <p className="my-2 font-display text-[38px] uppercase leading-[1.05] tracking-wide">Thursday<br />7:00 PM</p>
              <p className="text-[13px] leading-snug opacity-80">Tennis court Champion<br />Singles · Intermediate</p>
              <div className="mt-[18px] flex items-center justify-between gap-3">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">1 seat left</span>
                <Link href="/sign-up" className="rounded-full bg-[#edf4ef] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#4f775d] no-underline">
                  Join
                </Link>
              </div>
            </article>

            <article className="absolute left-0 top-[150px] w-[290px] -rotate-[7deg] rounded-[28px] border border-[#d9d0c9] bg-[#fffdfa] p-6 text-[#111111] shadow-[0_22px_55px_rgba(19,33,67,0.18)] sm:top-[175px] sm:w-[360px] lg:left-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#77716c]">Player</p>
              <p className="my-2 font-display text-[38px] uppercase leading-[1.05] tracking-wide">Sarah<br />Intermediate</p>
              <p className="text-[13px] leading-snug text-[#77716c]">Evenings · Singles / Doubles</p>
              <div className="mt-[18px] flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">Available this week</span>
                <Link href="/sign-up" className="text-[#111111] no-underline" aria-label="Create an account">→</Link>
              </div>
            </article>

            <article className="absolute bottom-1 right-0 w-[255px] rotate-[3deg] rounded-[28px] bg-[#ef6d87] p-6 text-[#111111] shadow-[0_22px_55px_rgba(19,33,67,0.18)] sm:w-[300px]">
              <p className="text-[10px] uppercase tracking-[0.2em] opacity-70">Court</p>
              <p className="my-2 font-display text-[38px] uppercase leading-[1.05] tracking-wide">Tennis Club</p>
              <p className="text-[13px] leading-snug opacity-80">6 courts · Lights</p>
            </article>
          </div>
        </section>

        <section id="games" className="border-t border-[#d9d0c9] py-[60px] lg:py-[82px]">
          <div className="mb-[30px] flex items-end justify-between gap-5">
            <div>
              <p className="mb-[11px] text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#8e7f77]">Play this week</p>
              <h2 className="m-0 font-display text-[46px] uppercase leading-[0.92] tracking-wide lg:text-[58px]">Open games</h2>
            </div>
            <Link href="/sign-up" className="shrink-0 border-b border-[#777] text-[13px] text-[#111111] no-underline">
              View all games →
            </Link>
          </div>
          <div className="grid gap-[18px] lg:grid-cols-[1.2fr_0.8fr_0.8fr]">
            {games.map((game) => (
              <article
                key={game.time}
                className={`relative flex min-h-[240px] flex-col justify-between overflow-hidden rounded-[26px] border border-[#d9d0c9] p-6 ${game.featured ? 'bg-[#25457f] text-white lg:min-h-[290px]' : 'bg-[#fffdfa]'}`}
              >
                {game.featured && (
                  <span aria-hidden className="pointer-events-none absolute -bottom-4 -right-2 font-display text-[84px] leading-none tracking-wide text-white/10">
                    MATCH
                  </span>
                )}
                <div>
                  <span className="inline-block rounded-full bg-[#edf4ef] px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#4f775d]">
                    {game.level}
                  </span>
                  <p className="my-3 text-[30px] font-black leading-tight">{game.time}</p>
                  <p className={`text-sm leading-normal ${game.featured ? 'text-white/70' : 'text-[#77716c]'}`}>
                    {game.place}<br />{game.detail}
                  </p>
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]">{game.seats}</span>
                  <Link href="/sign-up" className="rounded-full border-0 bg-[#ef6d87] px-[18px] py-3 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#111111] no-underline">
                    View game
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="players" className="border-t border-[#d9d0c9] py-[60px] lg:py-[82px]">
          <div className="mb-[30px] flex items-end justify-between gap-5">
            <div>
              <p className="mb-[11px] text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#8e7f77]">People, not profiles</p>
              <h2 className="m-0 font-display text-[46px] uppercase leading-[0.92] tracking-wide lg:text-[58px]">Players near you</h2>
            </div>
            <Link href="/sign-up" className="shrink-0 border-b border-[#777] text-[13px] text-[#111111] no-underline">
              See all players →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {players.map((player) => (
              <article key={player.name} className="rounded-[26px] border border-[#d9d0c9] bg-[#fffdfa] p-[18px]">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${player.face}`}>
                    <span className="font-display text-lg leading-none tracking-wide">{player.name.slice(0, 1)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[21px] font-black leading-none">{player.name}</p>
                    <p className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] ${player.chip}`}>
                      {player.level}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-snug text-[#77716c]">
                  {player.about}<br />{player.more}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="courts" className="border-t border-[#d9d0c9] py-[60px] lg:py-[82px]">
          <div className="mb-[30px] flex items-end justify-between gap-5">
            <div>
              <p className="mb-[11px] text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#8e7f77]">Know where to play</p>
              <h2 className="m-0 font-display text-[46px] uppercase leading-[0.92] tracking-wide lg:text-[58px]">Courts around you</h2>
            </div>
            <Link href="/sign-up" className="shrink-0 border-b border-[#777] text-[13px] text-[#111111] no-underline">
              Explore all courts →
            </Link>
          </div>
          <div className="grid gap-[18px] lg:grid-cols-[1.2fr_0.8fr]">
            <article className="relative min-h-[380px] overflow-hidden rounded-[30px] bg-[#4f775d] p-7 text-white">
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-70">Featured court</p>
              <h3 className="my-3 max-w-[420px] font-display text-5xl uppercase leading-[0.95] tracking-wide">Tennis Club</h3>
              <p className="max-w-[420px] leading-relaxed opacity-80">
                Six courts and lights for an evening match
              </p>
              <div className="absolute bottom-7 left-7 flex flex-wrap gap-2.5">
                {['6 courts', 'Lights', 'Outdoor'].map((tag) => (
                  <span key={tag} className="rounded-full border border-white/25 bg-white/15 px-2.5 py-2 text-[11px]">
                    {tag}
                  </span>
                ))}
              </div>
              <div aria-hidden className="pointer-events-none absolute -bottom-9 -right-9 hidden h-[270px] w-[390px] -rotate-[7deg] border-[5px] border-white/80 sm:block">
                <div className="absolute inset-y-0 left-1/2 w-[5px] -translate-x-1/2 bg-white/80" />
                <div className="absolute inset-x-0 top-1/2 h-[5px] -translate-y-1/2 bg-white/80" />
              </div>
            </article>
            <div className="grid gap-4">
              {courts.map((court) => (
                <article key={court.name} className="grid grid-cols-[92px_1fr] items-center gap-4 rounded-[24px] border border-[#d9d0c9] bg-[#fffdfa] p-[18px]">
                  <CourtThumb tone={court.tone} />
                  <div>
                    <p className="text-lg font-black">{court.name}</p>
                    <p className="mt-1 text-xs leading-snug text-[#77716c]">{court.sub}</p>
                    <Link href="/sign-up" className="mt-2 inline-block text-xs text-[#111111] underline">
                      View court →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#d9d0c9] py-[60px] lg:py-[82px]">
          <div className="grid gap-8 rounded-[34px] bg-[#111111] p-8 text-white lg:grid-cols-[0.8fr_1.2fr] lg:gap-[34px] lg:p-[42px]">
            <div>
              <p className="mb-[11px] text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#aaa]">How GAME. works</p>
              <h2 className="m-0 font-display text-[46px] uppercase leading-[0.92] tracking-wide text-white lg:text-[58px]">
                Find.<br />Join.<br />Play.
              </h2>
              <p className="mt-[18px] font-fraunces text-2xl italic text-[#c7ee6a]">
                Less coordination.<br />More tennis.
              </p>
            </div>
            <div className="grid gap-[18px] lg:grid-cols-3">
              {[
                ['01', 'Find', 'See how a player, a game, and a court look on this page.'],
                ['02', 'Join', 'Create an account when you want a real seat.'],
                ['03', 'Play', 'Meet on court. No endless group chats. No planning chaos.'],
              ].map(([num, title, copy]) => (
                <div key={num} className="border-t border-white/30 pt-4">
                  <p className="text-[11px] tracking-[0.18em] opacity-55">{num}</p>
                  <h3 className="my-2 font-display text-[34px] uppercase tracking-wide">{title}</h3>
                  <p className="text-[13px] leading-normal opacity-70">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#d9d0c9] py-[60px] lg:py-[82px]">
          <div className="relative flex flex-col items-start gap-7 overflow-hidden rounded-[34px] bg-[#ef6d87] p-8 sm:flex-row sm:items-center sm:justify-between lg:p-12">
            <span aria-hidden className="pointer-events-none absolute -right-4 -top-8 font-display text-[140px] leading-none tracking-wide text-black/10 sm:text-[170px]">
              PLAY
            </span>
            <div className="relative">
              <p className="mb-[11px] text-[10px] font-extrabold uppercase tracking-[0.25em] text-[#5b2633]">
                Your next match is closer than you think
              </p>
              <h2 className="m-0 font-display text-[46px] uppercase leading-[0.92] tracking-wide lg:text-[58px]">Ready to play?</h2>
              <p className="mt-3 max-w-[560px] leading-relaxed">
                Create your profile, set your level and availability, and start joining games.
              </p>
            </div>
            <div className="relative z-[1] flex flex-wrap gap-[13px]">
              <Link href="/sign-up" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#111111] px-6 text-[11px] font-extrabold uppercase tracking-[0.15em] text-white no-underline">
                Create account
              </Link>
              <Link href="/sign-in" className="inline-flex min-h-12 items-center justify-center rounded-full border border-black/35 px-6 text-[11px] font-extrabold uppercase tracking-[0.15em] text-[#111111] no-underline">
                Sign in
              </Link>
            </div>
          </div>
        </section>

        <footer className="space-y-4 pb-12 pt-2 text-xs leading-relaxed text-[#8b847f]">
          <p className="max-w-xl">
            The cards on this page are examples. They are not real players, games, or courts. Create an account to see real information.
          </p>
          <p className="max-w-xl">
            This page is public. You can read it without signing in. An account is for a profile, a message, and a place in the game. {appName} does not generate images. Sign in with Google only opens your account with your name, email address, and profile photo.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span>© 2026 GAME.</span>
            <span>
              <Link href="https://www.game-tennis.space/privacy" className="text-[#111111] underline underline-offset-2">Privacy Policy</Link>
              {' · '}
              <Link href="https://www.game-tennis.space/terms" className="text-[#111111] underline underline-offset-2">Terms of Use</Link>
            </span>
          </div>
        </footer>
      </div>
    </div>
  )
}
