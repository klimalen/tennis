'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SetScore {
  score_first: string
  score_second: string
  score_set: string
}

interface TennisMatch {
  event_key: number
  event_date: string
  event_time: string
  event_first_player: string
  first_player_key: number
  event_second_player: string
  second_player_key: number
  event_final_result: string
  event_game_result: string
  event_serve: string | null
  event_winner: string | null
  event_status: string
  event_type_type: string
  tournament_name: string
  tournament_key: number
  tournament_round: string
  event_live: string
  event_first_player_logo: string | null
  event_second_player_logo: string | null
  scores: SetScore[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAIN_TYPES = new Set([
  'Atp Singles', 'Wta Singles', 'Atp Doubles', 'Wta Doubles', 'Mixed Doubles',
])

const TYPE_LABEL: Record<string, string> = {
  'Atp Singles': 'ATP',
  'Wta Singles': 'WTA',
  'Atp Doubles': 'ATP Doubles',
  'Wta Doubles': 'WTA Doubles',
  'Mixed Doubles': 'Mixed Doubles',
  'Challenger Men Singles': 'Challenger',
  'Challenger Women Singles': 'Challenger W',
  'Boys Singles': 'Juniors Boys',
  'Girls Singles': 'Juniors Girls',
}

const CACHE_KEY = 'tour_tab_cache'
const CACHE_TTL = 60_000 // 1 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

async function fetchTennis(method: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ method, ...extra })
  const res = await fetch(`/api/tennis?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data?.result ?? null
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const { ts, live, fixtures } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return { live, fixtures }
  } catch { return null }
}

function writeCache(live: TennisMatch[], fixtures: TennisMatch[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), live, fixtures }))
  } catch { /* ignore */ }
}

// ─── Player avatar ────────────────────────────────────────────────────────────

function PlayerAvatar({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false)

  if (!url || failed) {
    return (
      <div className="w-7 h-7 bg-brand-surface border border-brand-divider flex items-center justify-center flex-shrink-0 rounded-full">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-[rgba(26,26,26,0.3)]">
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    )
  }

  return (
    <div className="w-7 h-7 overflow-hidden flex-shrink-0 rounded-full border border-brand-divider">
      <Image
        src={url}
        alt={name}
        width={28}
        height={28}
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  )
}

// ─── Set scores display ───────────────────────────────────────────────────────

function SetScores({ scores, winner }: { scores: SetScore[]; winner: string | null }) {
  if (!scores.length) return null
  return (
    <div className="flex gap-2">
      {scores.map((s) => {
        const p1Won = Number(s.score_first) > Number(s.score_second)
        const p2Won = Number(s.score_second) > Number(s.score_first)
        return (
          <div key={s.score_set} className="flex flex-col items-center gap-0.5 min-w-[16px]">
            <span className={`font-numbers text-[13px] leading-none ${p1Won ? 'text-[#1a1a1a] font-semibold' : 'text-[rgba(26,26,26,0.35)]'}`}>
              {s.score_first}
            </span>
            <span className={`font-numbers text-[13px] leading-none ${p2Won ? 'text-[#1a1a1a] font-semibold' : 'text-[rgba(26,26,26,0.35)]'}`}>
              {s.score_second}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, showTournament = false }: { match: TennisMatch; showTournament?: boolean }) {
  const isLive = match.event_live === '1'
  const isFinished = match.event_status === 'Finished'
  const p1Wins = match.event_winner === 'First Player'
  const p2Wins = match.event_winner === 'Second Player'

  return (
    <div className="px-4 py-3 border-b border-brand-divider last:border-0">

      {/* Tournament label */}
      {showTournament && (
        <p className="text-[9px] tracking-[0.12em] uppercase text-[rgba(26,26,26,0.3)] mb-2">
          {match.tournament_name} · {typeLabel(match.event_type_type)}
        </p>
      )}

      <div className="flex items-center gap-3">

        {/* Players */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <PlayerAvatar url={match.event_first_player_logo} name={match.event_first_player} />
            <span className={`text-[13px] flex-1 truncate leading-none ${p1Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.75)]'}`}>
              {match.event_first_player}
            </span>
            {isLive && match.event_serve === 'First Player' && (
              <span className="text-[8px] text-brand-primary font-medium">●</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <PlayerAvatar url={match.event_second_player_logo} name={match.event_second_player} />
            <span className={`text-[13px] flex-1 truncate leading-none ${p2Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.75)]'}`}>
              {match.event_second_player}
            </span>
            {isLive && match.event_serve === 'Second Player' && (
              <span className="text-[8px] text-brand-primary font-medium">●</span>
            )}
          </div>
        </div>

        {/* Score / Time */}
        <div className="flex-shrink-0 flex items-center gap-2">
          {(isFinished || isLive) ? (
            <SetScores scores={match.scores} winner={match.event_winner} />
          ) : (
            <span className="font-numbers text-sm text-[rgba(26,26,26,0.45)]">
              {match.event_time.slice(0, 5)}
            </span>
          )}

          {/* Current game score (live only) */}
          {isLive && match.event_game_result && match.event_game_result !== '-' && (
            <div className="flex flex-col items-center min-w-[30px] bg-brand-surface px-1.5 py-1">
              <span className="font-numbers text-[11px] leading-tight text-brand-primary">
                {match.event_game_result.split(' - ')[0]}
              </span>
              <span className="font-numbers text-[11px] leading-tight text-brand-primary">
                {match.event_game_result.split(' - ')[1]}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Live badge */}
      {isLive && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] tracking-[0.15em] uppercase text-red-500 font-medium">{match.event_status}</span>
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, badge, children }: {
  title: string
  badge?: number
  children: React.ReactNode
}) {
  return (
    <div className="mt-5">
      <div className="px-4 pb-2 flex items-center gap-2">
        <span className="font-display text-base tracking-wide text-[#1a1a1a]">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="font-numbers text-xs text-[rgba(26,26,26,0.35)]">{badge}</span>
        )}
      </div>
      <div className="border-t border-brand-divider">
        {children}
      </div>
    </div>
  )
}

function ShowMoreBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] hover:text-brand-primary transition-colors border-b border-brand-divider"
    >
      {label}
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="px-4 py-4 text-[11px] text-[rgba(26,26,26,0.35)] italic">{text}</p>
  )
}

// ─── Tournaments section ──────────────────────────────────────────────────────

interface TournamentGroup {
  name: string
  categories: string[]  // e.g. ["ATP", "WTA", "ATP Doubles"]
  totalMatches: number
}

function TournamentRow({ t }: { t: TournamentGroup }) {
  return (
    <div className="px-4 py-3 border-b border-brand-divider last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-[#1a1a1a] truncate">{t.name}</p>
          <p className="text-[10px] text-[rgba(26,26,26,0.4)] mt-0.5">{t.categories.join(' · ')}</p>
        </div>
        <span className="text-[10px] font-numbers text-[rgba(26,26,26,0.35)] flex-shrink-0">
          {t.totalMatches} matches
        </span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type ResultsFilter = 'today' | 'week'

const PREVIEW = 5

export function TourTab() {
  const [liveMatches, setLiveMatches] = useState<TennisMatch[]>([])
  const [allFixtures, setAllFixtures] = useState<TennisMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>('today')
  const [showAllLive, setShowAllLive] = useState(false)
  const [showAllSchedule, setShowAllSchedule] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)

  const loadData = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache()
      if (cached) {
        setLiveMatches(cached.live)
        setAllFixtures(cached.fixtures)
        setLoading(false)
        return
      }
    }

    const [live, fixtures] = await Promise.all([
      fetchTennis('get_livescore'),
      fetchTennis('get_fixtures', { date_start: yesterday(), date_stop: today() }),
    ])
    const liveData = (live as TennisMatch[] | null) ?? []
    const fixturesData = (fixtures as TennisMatch[] | null) ?? []
    setLiveMatches(liveData)
    setAllFixtures(fixturesData)
    writeCache(liveData, fixturesData)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(true), 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  // ── Derived data ──────────────────────────────────────────────────────────

  // Live: show ATP/WTA first, then rest
  const mainLive = liveMatches.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const otherLive = liveMatches.filter((m) => !MAIN_TYPES.has(m.event_type_type))
  const liveToShow = showAllLive
    ? [...mainLive, ...otherLive]
    : mainLive.slice(0, PREVIEW)

  // Schedule: today, not started, main types first
  const scheduled = allFixtures.filter(
    (m) => m.event_date === today() && m.event_status === 'Not Started' && m.event_live === '0'
  )
  const mainScheduled = scheduled.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const scheduleToShow = showAllSchedule ? scheduled : mainScheduled.slice(0, PREVIEW)

  // Results
  const todayFinished = allFixtures.filter(
    (m) => m.event_date === today() && m.event_status === 'Finished'
  )
  const allFinished = allFixtures.filter((m) => m.event_status === 'Finished')
  const mainTodayFinished = todayFinished.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const mainAllFinished = allFinished.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const displayedResults = resultsFilter === 'today' ? mainTodayFinished : mainAllFinished
  const resultsToShow = showAllResults ? displayedResults : displayedResults.slice(0, PREVIEW)

  // Tournaments: group by name, collect categories
  const tournamentMap = new Map<string, TournamentGroup>()
  for (const m of allFixtures) {
    if (!MAIN_TYPES.has(m.event_type_type)) continue
    const key = m.tournament_name.trim()
    const label = typeLabel(m.event_type_type)
    if (!tournamentMap.has(key)) {
      tournamentMap.set(key, { name: key, categories: [], totalMatches: 0 })
    }
    const t = tournamentMap.get(key)!
    t.totalMatches++
    if (!t.categories.includes(label)) t.categories.push(label)
  }
  const tournaments = Array.from(tournamentMap.values())

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Loading...</p>
      </div>
    )
  }

  return (
    <div className="pb-8">

      {/* LIVE */}
      <Section title="Live now" badge={liveMatches.length}>
        {liveToShow.length === 0 ? (
          <EmptyState text="No live matches at the moment" />
        ) : (
          <>
            {liveToShow.map((m) => <MatchCard key={m.event_key} match={m} showTournament />)}
            {!showAllLive && liveMatches.length > mainLive.slice(0, PREVIEW).length && (
              <ShowMoreBtn
                label={`Show all ${liveMatches.length} live matches`}
                onClick={() => setShowAllLive(true)}
              />
            )}
          </>
        )}
      </Section>

      {/* TODAY'S SCHEDULE */}
      <Section title="Today's schedule" badge={scheduled.length}>
        {scheduleToShow.length === 0 ? (
          <EmptyState text="No upcoming matches today" />
        ) : (
          <>
            {scheduleToShow.map((m) => <MatchCard key={m.event_key} match={m} showTournament />)}
            {!showAllSchedule && scheduled.length > mainScheduled.slice(0, PREVIEW).length && (
              <ShowMoreBtn
                label={`Show all ${scheduled.length} matches`}
                onClick={() => setShowAllSchedule(true)}
              />
            )}
          </>
        )}
      </Section>

      {/* RESULTS */}
      <Section title="Results">
        {/* Toggle */}
        <div className="px-4 py-3 flex items-center gap-1 border-b border-brand-divider">
          {([
            { id: 'today' as ResultsFilter, label: 'Today' },
            { id: 'week' as ResultsFilter, label: 'Yesterday + Today' },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => { setResultsFilter(f.id); setShowAllResults(false) }}
              className={`px-3 py-1.5 text-[9px] tracking-[0.15em] uppercase font-medium transition-colors border ${
                resultsFilter === f.id
                  ? 'border-brand-primary text-brand-primary bg-transparent'
                  : 'border-brand-divider text-[rgba(26,26,26,0.4)] hover:border-[rgba(26,26,26,0.3)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {resultsToShow.length === 0 ? (
          <EmptyState text="No results yet" />
        ) : (
          <>
            {resultsToShow.map((m) => <MatchCard key={m.event_key} match={m} showTournament />)}
            {!showAllResults && displayedResults.length > PREVIEW && (
              <ShowMoreBtn
                label={`Show all ${displayedResults.length} results`}
                onClick={() => setShowAllResults(true)}
              />
            )}
          </>
        )}
      </Section>

      {/* TOURNAMENTS */}
      {tournaments.length > 0 && (
        <Section title="Active tournaments" badge={tournaments.length}>
          {tournaments.map((t) => <TournamentRow key={t.name} t={t} />)}
        </Section>
      )}
    </div>
  )
}
