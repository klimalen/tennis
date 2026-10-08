import Link from 'next/link'

const appName = 'GAME. — Find and Play Tennis'

type Face = 'tan' | 'teal' | 'pink' | 'navy'
type Tone = 'beginner' | 'intermediate' | 'advanced' | 'competitive'

const faceClass: Record<Face, string> = {
  tan: 'bg-brand-avatar text-[#1a1a1a]',
  teal: 'bg-[#3A8A7A] text-[#F0EBE3]',
  pink: 'bg-[#E8748A] text-[#1a1a1a]',
  navy: 'bg-[#1E3A6E] text-[#F0EBE3]',
}

const toneClass: Record<Tone, string> = {
  beginner: 'bg-[#E8E1D7] text-[#1a1a1a]',
  intermediate: 'bg-[#3A8A7A] text-[#F0EBE3]',
  advanced: 'bg-[#E8748A] text-[#1a1a1a]',
  competitive: 'bg-[#D4A017] text-[#1E3A6E]',
}

type Player = { name: string; level: string; tone: Tone; line: string; face: Face }
type Game = { day: string; time: string; place: string; meta: string }
type Court = { name: string; meta: string }

const players: Player[] = [
  { name: 'Nia Cole', level: 'Intermediate', tone: 'intermediate', line: 'Evening rallies and a short warm-up', face: 'teal' },
  { name: 'Owen Marsh', level: 'Advanced', tone: 'advanced', line: 'Doubles on the weekend', face: 'pink' },
  { name: 'Thea Quinn', level: 'Beginner', tone: 'beginner', line: 'Still learning to rally', face: 'tan' },
  { name: 'Marco Vela', level: 'Competitive', tone: 'competitive', line: 'Serious sets', face: 'navy' },
]

const games: Game[] = [
  { day: 'Sat', time: '9 AM', place: 'Baseline Club', meta: 'Doubles · 2 spots left' },
  { day: 'Sun', time: '4 PM', place: 'Court 4', meta: 'Singles · 1 spot left' },
  { day: 'Tue', time: '7 PM', place: 'Line House', meta: 'Doubles · 3 spots left' },
]

const courts: Court[] = [
  { name: 'Baseline Club', meta: 'Hard · Outdoor · Lit · 6 courts' },
  { name: 'Court 4', meta: 'Clay · Outdoor · 4 courts' },
  { name: 'Line House', meta: 'Hard · Indoor · 3 courts' },
  { name: 'The Evening Set', meta: 'Hard · Outdoor · Free' },
]

function initials(name: string) {
  return name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function PlayerCard({ player }: { player: Player }) {
  return (
    <article className="w-[270px] shrink-0 rounded-[28px] bg-white p-4">
      <div className="flex items-center gap-3">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${faceClass[player.face]}`}>
          <span className="font-display text-xl tracking-wide">{initials(player.name)}</span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-display text-2xl leading-none tracking-wide uppercase">{player.name}</p>
          <p className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${toneClass[player.tone]}`}>
            {player.level}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-snug text-[rgba(26,26,26,0.55)]">{player.line}</p>
    </article>
  )
}

function GameCard({ game }: { game: Game }) {
  return (
    <article className="w-[280px] shrink-0 overflow-hidden rounded-[28px] bg-[#3A8A7A] text-[#F0EBE3]">
      <div className="flex min-h-[108px]">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center bg-[#2C6A5C]">
          <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#F0EBE3]/70">{game.day}</span>
          <span className="mt-1 font-display text-lg leading-none tracking-wide">{game.time}</span>
        </div>
        <div className="min-w-0 flex-1 px-3 py-3">
          <p className="truncate font-display text-2xl leading-none tracking-wide uppercase">{game.place}</p>
          <p className="mt-2 text-[13px] text-[#F0EBE3]/80">{game.meta}</p>
        </div>
      </div>
    </article>
  )
}

function CourtCard({ court }: { court: Court }) {
  return (
    <article className="flex w-[250px] shrink-0 flex-col justify-between rounded-[28px] bg-white p-4">
      <p className="text-[9px] font-medium uppercase tracking-[0.16em] text-[#3A8A7A]">Courts</p>
      <p className="mt-3 font-display text-3xl leading-none tracking-wide uppercase">{court.name}</p>
      <p className="mt-2 text-[13px] text-[rgba(26,26,26,0.55)]">{court.meta}</p>
    </article>
  )
}

type StripItem =
  | { id: string; kind: 'player'; player: Player }
  | { id: string; kind: 'game'; game: Game }
  | { id: string; kind: 'court'; court: Court }

const rowA: StripItem[] = [
  { id: 'p-nia', kind: 'player', player: players[0]! },
  { id: 'g-sat', kind: 'game', game: games[0]! },
  { id: 'p-owen', kind: 'player', player: players[1]! },
  { id: 'c-base', kind: 'court', court: courts[0]! },
  { id: 'g-sun', kind: 'game', game: games[1]! },
  { id: 'p-thea', kind: 'player', player: players[2]! },
]

const rowB: StripItem[] = [
  { id: 'c-four', kind: 'court', court: courts[1]! },
  { id: 'p-marco', kind: 'player', player: players[3]! },
  { id: 'g-tue', kind: 'game', game: games[2]! },
  { id: 'c-line', kind: 'court', court: courts[2]! },
  { id: 'p-nia-b', kind: 'player', player: players[0]! },
  { id: 'c-eve', kind: 'court', court: courts[3]! },
]

function StripCard({ item }: { item: StripItem }) {
  if (item.kind === 'player') return <PlayerCard player={item.player} />
  if (item.kind === 'game') return <GameCard game={item.game} />
  return <CourtCard court={item.court} />
}

function MarqueeRow({ items, reverse = false }: { items: StripItem[]; reverse?: boolean }) {
  return (
    <div className="max-w-full overflow-hidden motion-reduce:overflow-x-auto">
      <div className={`flex w-max ${reverse ? 'home-marquee-back' : 'home-marquee'}`}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-3 pr-3">
            {items.map((item) => (
              <StripCard key={`${copy}-${item.id}`} item={item} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

const doors = [
  { title: 'Players', line: 'See who wants to hit' },
  { title: 'Open games', line: 'Take an open seat' },
  { title: 'Courts', line: 'Find a place to play' },
]

export function WebLanding() {
  return (
    <div className="min-h-screen bg-brand-bg text-[#1a1a1a]">
      <style>{`
        @keyframes home-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes home-marquee-back { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        .home-marquee { animation: home-marquee 46s linear infinite; }
        .home-marquee-back { animation: home-marquee-back 54s linear infinite; }
        .home-marquee:hover, .home-marquee-back:hover { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .home-marquee, .home-marquee-back { animation: none; }
        }
      `}</style>

      <header className="sticky top-0 z-20 bg-brand-bg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <p className="text-[10px] tracking-[0.28em] uppercase text-[#85648F]">✦ GAME.</p>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#1E3A6E] hover:underline">
              Sign in
            </Link>
            <Link href="/sign-up" className="rounded-full bg-[#E8748A] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]">
              Join
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl items-center gap-8 px-5 pb-4 pt-6 sm:pt-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pb-8">
          <div>
            <h1 className="max-w-xl font-display text-6xl leading-[0.88] tracking-wide sm:text-8xl">
              FIND A GAME
            </h1>
            <p className="mt-4 font-fraunces text-xl italic text-[#497250] sm:text-2xl">
              A partner near you, this week
            </p>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-[rgba(26,26,26,0.72)]">
              {appName} is where you find a player, join an open game, and see public courts.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/sign-up" className="rounded-full bg-[#E8748A] px-6 py-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]">
                Create an account
              </Link>
              <Link href="/sign-in" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#1E3A6E] hover:underline">
                Sign in
              </Link>
            </div>
          </div>
          <div className="hidden flex-col gap-3 lg:flex">
            <PlayerCard player={players[0]!} />
            <GameCard game={games[0]!} />
          </div>
        </section>

        <section className="mt-6 space-y-3 sm:mt-8" aria-hidden>
          <p className="mx-auto max-w-5xl px-5 text-[10px] tracking-[0.28em] uppercase text-[#85648F]">✦ Examples</p>
          <MarqueeRow items={rowA} />
          <MarqueeRow items={rowB} reverse />
        </section>

        <section className="mx-auto mt-12 max-w-5xl px-5">
          <ul className="grid gap-3 sm:grid-cols-3">
            {doors.map((door) => (
              <li key={door.title}>
                <Link href="/sign-up" className="block h-full rounded-[28px] bg-white px-5 py-5 transition-colors hover:bg-[#F4F1EC]">
                  <p className="font-display text-3xl tracking-wide uppercase">{door.title}</p>
                  <p className="mt-2 text-sm text-[rgba(26,26,26,0.6)]">{door.line}</p>
                </Link>
              </li>
            ))}
          </ul>

          <section className="mt-3 rounded-[28px] bg-[#1E3A6E] px-6 py-7 text-[#F0EBE3]">
            <p className="font-display text-4xl leading-none tracking-wide">THEN TAKE A SEAT</p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href="/sign-up" className="rounded-full bg-[#E8748A] px-6 py-3.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]">
                Create an account
              </Link>
              <Link href="/sign-in" className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#F0EBE3] underline underline-offset-4">
                Sign in
              </Link>
            </div>
          </section>
        </section>

        <footer className="mx-auto mt-10 max-w-5xl space-y-3 px-5 pb-24 text-[13px] leading-relaxed text-[rgba(26,26,26,0.5)]">
          <p className="max-w-xl">
            The cards on this page are examples. They do not contain real players, games, or courts. Create an account to see real information.
          </p>
          <p className="max-w-xl">
            This page is public. You can read it without signing in. An account is for a profile, a message, and a place in the game. {appName} does not generate images. Sign in with Google only opens your account with your name, email address, and profile photo.
          </p>
          <p>
            <Link href="https://www.game-tennis.space/privacy" className="text-[#1a1a1a] underline underline-offset-2">
              Privacy Policy
            </Link>
            {' · '}
            <Link href="https://www.game-tennis.space/terms" className="text-[#1a1a1a] underline underline-offset-2">
              Terms of Use
            </Link>
          </p>
        </footer>
      </main>
    </div>
  )
}
