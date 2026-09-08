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
  event_final_result: string   // sets: "1 - 0"
  event_game_result: string    // current: "30 - 15" or "-"
  event_serve: string | null   // "First Player" | "Second Player"
  event_winner: string | null
  event_status: string         // "Set 2" | "Finished" | "Not Started"
  event_type_type: string      // "Atp Singles" | "Wta Singles" | ...
  tournament_name: string
  tournament_key: number
  tournament_round: string
  event_live: string           // "1" | "0"
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
  'Atp Doubles': 'ATP DBL',
  'Wta Doubles': 'WTA DBL',
  'Mixed Doubles': 'Mixed',
  'Challenger Men Singles': 'Challenger',
  'Challenger Women Singles': 'Challenger',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type
}

function formatTime(time: string) {
  // time is HH:MM in server timezone — show as-is
  return time.slice(0, 5)
}

async function fetchTennis(method: string, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ method, ...extra })
  const res = await fetch(`/api/tennis?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  return data?.result ?? null
}

function today() {
  return new Date().toISOString().slice(0, 10)
}
function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PlayerAvatar({ url, name }: { url: string | null; name: string }) {
  if (!url) {
    return (
      <div className="w-7 h-7 bg-brand-surface border border-brand-divider flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{name[0]}</span>
      </div>
    )
  }
  return (
    <div className="w-7 h-7 overflow-hidden flex-shrink-0 border border-brand-divider">
      <Image src={url} alt={name} width={28} height={28} className="w-full h-full object-cover" />
    </div>
  )
}

function SetScores({ scores, serve, winnerId }: {
  scores: SetScore[]
  serve: string | null
  winnerId: string | null // "First Player" | "Second Player" | null
}) {
  if (!scores.length) return null
  return (
    <div className="flex gap-1.5 items-start">
      {scores.map((s) => (
        <div key={s.score_set} className="flex flex-col items-center gap-0.5 min-w-[18px]">
          <span className={`font-numbers text-sm leading-none ${
            Number(s.score_first) > Number(s.score_second) ? 'text-brand-primary font-medium' : 'text-[rgba(26,26,26,0.4)]'
          }`}>{s.score_first}</span>
          <span className={`font-numbers text-sm leading-none ${
            Number(s.score_second) > Number(s.score_first) ? 'text-brand-primary font-medium' : 'text-[rgba(26,26,26,0.4)]'
          }`}>{s.score_second}</span>
        </div>
      ))}
    </div>
  )
}

function MatchRow({ match, showTournament = false }: { match: TennisMatch; showTournament?: boolean }) {
  const isLive = match.event_live === '1'
  const isFinished = match.event_status === 'Finished'
  const p1Wins = match.event_winner === 'First Player'
  const p2Wins = match.event_winner === 'Second Player'

  return (
    <div className="px-4 py-3 border-b border-brand-divider last:border-0">
      {showTournament && (
        <p className="text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-2">
          {match.tournament_name} · {typeLabel(match.event_type_type)}
        </p>
      )}

      <div className="flex items-center gap-3">
        {/* Players column */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* Player 1 */}
          <div className="flex items-center gap-2">
            <PlayerAvatar url={match.event_first_player_logo} name={match.event_first_player} />
            <span className={`text-sm flex-1 truncate ${p1Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.7)]'}`}>
              {match.event_first_player}
            </span>
            {isLive && match.event_serve === 'First Player' && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
            )}
          </div>
          {/* Player 2 */}
          <div className="flex items-center gap-2">
            <PlayerAvatar url={match.event_second_player_logo} name={match.event_second_player} />
            <span className={`text-sm flex-1 truncate ${p2Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.7)]'}`}>
              {match.event_second_player}
            </span>
            {isLive && match.event_serve === 'Second Player' && (
              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary flex-shrink-0" />
            )}
          </div>
        </div>

        {/* Score column */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isFinished || isLive ? (
            <SetScores scores={match.scores} serve={match.event_serve} winnerId={match.event_winner} />
          ) : (
            <span className="font-numbers text-sm text-[rgba(26,26,26,0.4)]">{formatTime(match.event_time)}</span>
          )}

          {/* Live game score */}
          {isLive && match.event_game_result && match.event_game_result !== '-' && (
            <div className="flex flex-col items-center min-w-[28px]">
              <span className="font-numbers text-[11px] leading-tight text-brand-primary">{match.event_game_result.split(' - ')[0]}</span>
              <span className="font-numbers text-[11px] leading-tight text-brand-primary">{match.event_game_result.split(' - ')[1]}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live status */}
      {isLive && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] tracking-[0.15em] uppercase text-red-500 font-medium">{match.event_status}</span>
        </div>
      )}
    </div>
  )
}

function Section({ title, children, count }: { title: string; children: React.ReactNode; count?: number }) {
  return (
    <div className="border-t border-brand-divider">
      <div className="px-4 py-3 flex items-center gap-2">
        <span className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">{title}</span>
        {count !== undefined && count > 0 && (
          <span className="text-[9px] font-numbers text-[rgba(26,26,26,0.3)]">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 pb-4 text-center">
      <p className="text-[10px] text-[rgba(26,26,26,0.3)]">{text}</p>
    </div>
  )
}

// ─── Tournaments section ───────────────────────────────────────────────────────

function TournamentCard({ name, type, surface, count }: {
  name: string; type: string; surface?: string; count: number
}) {
  const surfaceColor: Record<string, string> = {
    Hard: 'bg-blue-100 text-blue-600',
    Clay: 'bg-orange-100 text-orange-600',
    Grass: 'bg-green-100 text-green-600',
    Indoor: 'bg-purple-100 text-purple-600',
    Carpet: 'bg-purple-100 text-purple-600',
  }
  const sc = surface ? surfaceColor[surface] ?? 'bg-brand-surface text-[rgba(26,26,26,0.5)]' : ''

  return (
    <div className="px-4 py-3 border-b border-brand-divider last:border-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#1a1a1a] truncate">{name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[9px] tracking-[0.12em] uppercase text-[rgba(26,26,26,0.4)]">{typeLabel(type)}</span>
            {surface && (
              <span className={`text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 font-medium ${sc}`}>{surface}</span>
            )}
          </div>
        </div>
        <span className="text-[10px] font-numbers text-[rgba(26,26,26,0.35)] flex-shrink-0">{count} matches</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type ResultsFilter = 'today' | 'week'

export function TourTab() {
  const [liveMatches, setLiveMatches] = useState<TennisMatch[]>([])
  const [todayMatches, setTodayMatches] = useState<TennisMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>('today')
  const [showAllLive, setShowAllLive] = useState(false)
  const [showAllSchedule, setShowAllSchedule] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)

  const loadData = useCallback(async () => {
    const [live, fixtures] = await Promise.all([
      fetchTennis('get_livescore'),
      fetchTennis('get_fixtures', { date_start: yesterday(), date_stop: today() }),
    ])
    setLiveMatches((live as TennisMatch[] | null) ?? [])
    setTodayMatches((fixtures as TennisMatch[] | null) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  // Categorise matches
  const mainLive = liveMatches.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const allLive = liveMatches

  const todayScheduled = todayMatches.filter(
    (m) => m.event_date === today() && m.event_status === 'Not Started' && m.event_live === '0'
  )
  const mainScheduled = todayScheduled.filter((m) => MAIN_TYPES.has(m.event_type_type))

  const todayResults = todayMatches.filter(
    (m) => m.event_date === today() && m.event_status === 'Finished'
  )
  const weekResults = todayMatches.filter((m) => m.event_status === 'Finished')
  const mainTodayResults = todayResults.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const mainWeekResults = weekResults.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const displayedResults = resultsFilter === 'today' ? mainTodayResults : mainWeekResults

  // Tournaments: unique from today's fixtures (main types)
  const tournamentsMap = new Map<number, { name: string; type: string; surface: string; count: number }>()
  for (const m of todayMatches) {
    if (!MAIN_TYPES.has(m.event_type_type)) continue
    if (tournamentsMap.has(m.tournament_key)) {
      tournamentsMap.get(m.tournament_key)!.count++
    } else {
      tournamentsMap.set(m.tournament_key, {
        name: m.tournament_name,
        type: m.event_type_type,
        surface: '',
        count: 1,
      })
    }
  }
  const tournaments = Array.from(tournamentsMap.values())

  const PREVIEW = 5

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Loading...</p>
      </div>
    )
  }

  const liveToShow = showAllLive ? allLive : mainLive.slice(0, PREVIEW)
  const scheduleToShow = showAllSchedule ? todayScheduled : mainScheduled.slice(0, PREVIEW)
  const resultsToShow = showAllResults ? displayedResults : displayedResults.slice(0, PREVIEW)

  return (
    <div>
      {/* LIVE NOW */}
      <Section title="Live now" count={allLive.length}>
        {liveToShow.length === 0 ? (
          <EmptyState text="No live matches right now" />
        ) : (
          <>
            {liveToShow.map((m) => <MatchRow key={m.event_key} match={m} showTournament />)}
            {!showAllLive && allLive.length > mainLive.slice(0, PREVIEW).length && (
              <button
                onClick={() => setShowAllLive(true)}
                className="w-full py-2.5 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] hover:text-brand-primary transition-colors"
              >
                Show all {allLive.length} live matches
              </button>
            )}
          </>
        )}
      </Section>

      {/* TODAY'S SCHEDULE */}
      <Section title="Today" count={todayScheduled.length}>
        {scheduleToShow.length === 0 ? (
          <EmptyState text="No matches scheduled" />
        ) : (
          <>
            {scheduleToShow.map((m) => <MatchRow key={m.event_key} match={m} showTournament />)}
            {!showAllSchedule && todayScheduled.length > mainScheduled.slice(0, PREVIEW).length && (
              <button
                onClick={() => setShowAllSchedule(true)}
                className="w-full py-2.5 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] hover:text-brand-primary transition-colors"
              >
                Show all {todayScheduled.length} matches
              </button>
            )}
          </>
        )}
      </Section>

      {/* RESULTS */}
      <Section title="Results">
        {/* Filter toggle */}
        <div className="px-4 pb-2 flex gap-3">
          {(['today', 'week'] as ResultsFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setResultsFilter(f)}
              className={`text-[9px] tracking-[0.15em] uppercase font-medium transition-colors ${
                resultsFilter === f ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.35)] hover:text-[rgba(26,26,26,0.6)]'
              }`}
            >
              {f === 'today' ? 'Today' : 'Yesterday + Today'}
            </button>
          ))}
        </div>
        {resultsToShow.length === 0 ? (
          <EmptyState text="No results yet" />
        ) : (
          <>
            {resultsToShow.map((m) => <MatchRow key={m.event_key} match={m} showTournament />)}
            {!showAllResults && displayedResults.length > PREVIEW && (
              <button
                onClick={() => setShowAllResults(true)}
                className="w-full py-2.5 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] hover:text-brand-primary transition-colors"
              >
                Show all {displayedResults.length} results
              </button>
            )}
          </>
        )}
      </Section>

      {/* TOURNAMENTS */}
      {tournaments.length > 0 && (
        <Section title="Active tournaments" count={tournaments.length}>
          {tournaments.map((t) => (
            <TournamentCard key={t.name + t.type} {...t} />
          ))}
        </Section>
      )}
    </div>
  )
}
