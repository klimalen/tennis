'use client'

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { X, ChevronDown, ChevronUp } from 'lucide-react'

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

interface TournamentMeta {
  tournament_key: number
  tournament_name: string
  event_type_key: number
  event_type_type: string
  tournament_sourface: string
}

interface PlayerStat {
  season: string
  type: string
  rank: string
  titles: string
  matches_won: string
  matches_lost: string
}

interface PlayerProfile {
  player_key: number
  player_name: string
  player_full_name: string
  player_country: string
  player_bday: string
  player_logo: string | null
  stats: PlayerStat[]
}

interface DrawMatch {
  draw_key: number
  match_number: number
  status: string
  live: boolean
  first_player: { player_key: number; name: string; seed: string | null; logo: string | null }
  second_player: { player_key: number; name: string; seed: string | null; logo: string | null } | null
  result: string
  winner_player_key: number | null
}

interface DrawRound {
  round_name: string
  matches: DrawMatch[]
}

interface DrawBracket {
  stage: string
  qualification: boolean
  rounds: DrawRound[]
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
const CACHE_TTL = 60_000

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

function formatMatchDate(dateStr: string): string {
  if (dateStr === today()) return 'Today'
  if (dateStr === yesterday()) return 'Yesterday'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function parseRound(round: string): string {
  // "US Open - Quarterfinals" → "Quarterfinals"
  const idx = round.indexOf(' - ')
  if (idx !== -1) return round.slice(idx + 3)
  return round
}

function calcAge(bday: string): number | null {
  // Format: "DD.MM.YYYY"
  const parts = bday.split('.')
  if (parts.length !== 3) return null
  const birth = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--
  return age
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
    const { ts, live, fixtures, tournaments } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) return null
    return { live, fixtures, tournaments }
  } catch { return null }
}

function writeCache(live: TennisMatch[], fixtures: TennisMatch[], tournaments: TournamentMeta[]) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), live, fixtures, tournaments }))
  } catch { /* ignore */ }
}

// ─── Bottom sheet wrapper ─────────────────────────────────────────────────────

function BottomSheet({ open, onClose, title, children }: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-brand-bg max-h-[90vh] flex flex-col">
        {/* Handle */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-brand-divider flex-shrink-0">
          <span className="font-display text-xl tracking-wide">{title.toUpperCase()}</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.4)] hover:text-[#1a1a1a]">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Player sheet ─────────────────────────────────────────────────────────────

function PlayerSheet({ playerKey, name, logo, onClose }: {
  playerKey: number
  name: string
  logo: string | null
  onClose: () => void
}) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTennis('get_players', { player_key: String(playerKey) }).then((r) => {
      setProfile(Array.isArray(r) ? r[0] : null)
      setLoading(false)
    })
  }, [playerKey])

  // Current season stats (singles)
  const currentYear = String(new Date().getFullYear())
  const currentStats = profile?.stats
    .filter((s) => s.type === 'singles')
    .sort((a, b) => Number(b.season) - Number(a.season))

  const latestStat = currentStats?.[0]
  const currentStat = currentStats?.find((s) => s.season === currentYear)

  const age = profile?.player_bday ? calcAge(profile.player_bday) : null

  return (
    <BottomSheet open onClose={onClose} title={profile?.player_full_name ?? name}>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Loading...</p>
        </div>
      ) : !profile ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-[rgba(26,26,26,0.4)]">Player data not available</p>
        </div>
      ) : (
        <div className="pb-8">
          {/* Hero */}
          <div className="px-4 pt-5 pb-4 flex items-center gap-4">
            <div className="w-16 h-16 rounded-full overflow-hidden border border-brand-divider bg-brand-surface flex-shrink-0">
              {profile.player_logo ? (
                <Image src={profile.player_logo} alt={profile.player_full_name} width={64} height={64} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-[rgba(26,26,26,0.3)]">
                    <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
            </div>
            <div>
              <p className="font-display text-2xl tracking-wide leading-none">{profile.player_full_name.toUpperCase()}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {profile.player_country && (
                  <span className="text-[10px] tracking-[0.12em] text-[rgba(26,26,26,0.5)]">{profile.player_country}</span>
                )}
                {age && (
                  <span className="text-[10px] tracking-[0.12em] text-[rgba(26,26,26,0.35)]">· {age} y.o.</span>
                )}
                {latestStat?.rank && (
                  <span className="text-[9px] tracking-[0.15em] uppercase font-medium text-brand-primary border border-brand-primary px-2 py-0.5">
                    #{latestStat.rank}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Current season stats */}
          {currentStat && (
            <div className="border-t border-brand-divider px-4 py-4">
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-3">{currentYear} Season</p>
              <div className="flex gap-6">
                {[
                  { label: 'W/L', value: `${currentStat.matches_won}/${currentStat.matches_lost}` },
                  { label: 'Titles', value: currentStat.titles || '0' },
                  { label: 'Rank', value: currentStat.rank ? `#${currentStat.rank}` : '—' },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col items-center gap-0.5">
                    <span className="font-numbers text-2xl leading-none text-brand-primary">{s.value}</span>
                    <span className="text-[8px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Season history */}
          {currentStats && currentStats.length > 0 && (
            <div className="border-t border-brand-divider px-4 py-4">
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-3">Career (singles)</p>
              <div className="flex flex-col gap-0">
                {currentStats.slice(0, 5).map((s) => (
                  <div key={s.season} className="flex items-center justify-between py-2 border-b border-brand-divider last:border-0">
                    <span className="font-numbers text-sm text-[rgba(26,26,26,0.6)]">{s.season}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-[rgba(26,26,26,0.5)]">{s.matches_won}W / {s.matches_lost}L</span>
                      {s.titles !== '0' && (
                        <span className="text-[10px] text-brand-primary font-medium">{s.titles} title{Number(s.titles) > 1 ? 's' : ''}</span>
                      )}
                      {s.rank && (
                        <span className="font-numbers text-[11px] text-[rgba(26,26,26,0.4)]">#{s.rank}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

// ─── Tournament draw sheet ────────────────────────────────────────────────────

function DrawMatchRow({ match }: { match: DrawMatch }) {
  const p1Wins = match.winner_player_key === match.first_player?.player_key
  const p2Wins = match.second_player && match.winner_player_key === match.second_player.player_key
  const isLive = match.live

  return (
    <div className="px-4 py-3 border-b border-brand-divider last:border-0">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {/* P1 */}
          <div className="flex items-center gap-2">
            {match.first_player?.seed && (
              <span className="font-numbers text-[9px] text-[rgba(26,26,26,0.4)] w-4 text-right flex-shrink-0">{match.first_player.seed}</span>
            )}
            <span className={`text-[13px] truncate leading-none flex-1 ${p1Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.7)]'}`}>
              {match.first_player?.name ?? 'TBD'}
            </span>
          </div>
          {/* P2 */}
          <div className="flex items-center gap-2">
            {match.first_player?.seed && (
              <span className="font-numbers text-[9px] text-[rgba(26,26,26,0.4)] w-4 text-right flex-shrink-0">
                {match.second_player?.seed ?? ''}
              </span>
            )}
            <span className={`text-[13px] truncate leading-none flex-1 ${p2Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.7)]'}`}>
              {match.second_player?.name ?? 'TBD'}
            </span>
          </div>
        </div>

        <div className="flex-shrink-0 text-right">
          {match.status === 'Finished' || isLive ? (
            <div className="flex flex-col gap-0.5">
              <span className={`font-numbers text-[13px] leading-none ${p1Wins ? 'text-[#1a1a1a] font-semibold' : 'text-[rgba(26,26,26,0.35)]'}`}>
                {match.result.split(' - ')[0]}
              </span>
              <span className={`font-numbers text-[13px] leading-none ${p2Wins ? 'text-[#1a1a1a] font-semibold' : 'text-[rgba(26,26,26,0.35)]'}`}>
                {match.result.split(' - ')[1]}
              </span>
            </div>
          ) : (
            <span className="text-[10px] text-[rgba(26,26,26,0.35)]">—</span>
          )}
          {isLive && (
            <div className="flex items-center gap-1 mt-1 justify-end">
              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[8px] text-red-500 uppercase tracking-[0.1em]">Live</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TournamentDrawSheet({ name, tournamentKey, eventTypeKey, eventTypeType, onClose }: {
  name: string
  tournamentKey: number
  eventTypeKey: number
  eventTypeType: string
  onClose: () => void
}) {
  const [brackets, setBrackets] = useState<DrawBracket[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedRounds, setExpandedRounds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTennis('get_draw', {
      tournament_key: String(tournamentKey),
      event_type: String(eventTypeKey),
    }).then((r) => {
      const data = r as { brackets?: DrawBracket[] } | null
      setBrackets(data?.brackets ?? [])
      setLoading(false)
    })
  }, [tournamentKey, eventTypeKey])

  // Show only main (non-qualification) bracket
  const mainBracket = brackets.find((b) => !b.qualification) ?? brackets[0]
  const rounds = mainBracket?.rounds ?? []

  // By default show last 4 rounds (SF, QF, R16, R32)
  const defaultVisibleRounds = new Set(rounds.slice(-4).map((r) => r.round_name))

  function toggleRound(roundName: string) {
    setExpandedRounds((prev) => {
      const next = new Set(prev)
      if (next.has(roundName)) next.delete(roundName)
      else next.add(roundName)
      return next
    })
  }

  function isRoundVisible(roundName: string) {
    return defaultVisibleRounds.has(roundName) || expandedRounds.has(roundName)
  }

  return (
    <BottomSheet open onClose={onClose} title={`${name} · ${typeLabel(eventTypeType)}`}>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Loading draw...</p>
        </div>
      ) : rounds.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm text-[rgba(26,26,26,0.4)]">Draw not available yet</p>
        </div>
      ) : (
        <div className="pb-8">
          {[...rounds].reverse().map((round) => {
            const visible = isRoundVisible(round.round_name)
            const isDefault = defaultVisibleRounds.has(round.round_name)
            return (
              <div key={round.round_name} className="border-t border-brand-divider">
                <button
                  className="w-full px-4 py-3 flex items-center justify-between"
                  onClick={() => !isDefault && toggleRound(round.round_name)}
                >
                  <span className="font-display text-base tracking-wide">{parseRound(round.round_name).toUpperCase()}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-numbers text-[10px] text-[rgba(26,26,26,0.35)]">{round.matches.length}</span>
                    {!isDefault && (
                      visible ? <ChevronUp size={14} className="text-[rgba(26,26,26,0.4)]" /> : <ChevronDown size={14} className="text-[rgba(26,26,26,0.4)]" />
                    )}
                  </div>
                </button>
                {visible && round.matches.map((m) => (
                  <DrawMatchRow key={m.draw_key} match={m} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </BottomSheet>
  )
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
      <Image src={url} alt={name} width={28} height={28} className="w-full h-full object-cover" onError={() => setFailed(true)} />
    </div>
  )
}

// ─── Set scores ───────────────────────────────────────────────────────────────

function parseScore(raw: string): { games: string; tb: string | null } {
  if (raw.includes('.')) {
    const parts = raw.split('.')
    return { games: parts[0] ?? raw, tb: parts[1] ?? null }
  }
  return { games: raw, tb: null }
}

function SetScores({ scores }: { scores: SetScore[] }) {
  if (!scores.length) return null
  return (
    <div className="flex gap-2">
      {scores.map((s) => {
        const p1 = parseScore(s.score_first)
        const p2 = parseScore(s.score_second)
        const p1Won = Number(p1.games) > Number(p2.games)
        const p2Won = Number(p2.games) > Number(p1.games)
        return (
          <div key={s.score_set} className="flex flex-col items-center gap-0.5">
            <div className="flex items-start gap-0.5">
              <span className={`font-numbers text-[13px] leading-none ${p1Won ? 'text-[#1a1a1a] font-semibold' : 'text-[rgba(26,26,26,0.35)]'}`}>{p1.games}</span>
              {p1.tb && <span className="font-numbers text-[8px] leading-none text-[rgba(26,26,26,0.4)] mt-0.5">{p1.tb}</span>}
            </div>
            <div className="flex items-start gap-0.5">
              <span className={`font-numbers text-[13px] leading-none ${p2Won ? 'text-[#1a1a1a] font-semibold' : 'text-[rgba(26,26,26,0.35)]'}`}>{p2.games}</span>
              {p2.tb && <span className="font-numbers text-[8px] leading-none text-[rgba(26,26,26,0.4)] mt-0.5">{p2.tb}</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Match card ───────────────────────────────────────────────────────────────

interface SelectedPlayer {
  key: number
  name: string
  logo: string | null
}

function MatchCard({ match, showTournament = false, onPlayerClick }: {
  match: TennisMatch
  showTournament?: boolean
  onPlayerClick: (p: SelectedPlayer) => void
}) {
  const isLive = match.event_live === '1'
  const isFinished = match.event_status === 'Finished'
  const p1Wins = match.event_winner === 'First Player'
  const p2Wins = match.event_winner === 'Second Player'
  const round = parseRound(match.tournament_round)

  return (
    <div className="px-4 py-3 border-b border-brand-divider last:border-0">
      {/* Meta */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showTournament && (
            <p className="text-[9px] tracking-[0.12em] uppercase text-[rgba(26,26,26,0.3)] truncate">
              {match.tournament_name} · {typeLabel(match.event_type_type)}
            </p>
          )}
          {round && (
            <p className="text-[9px] tracking-[0.1em] text-[rgba(26,26,26,0.25)] truncate flex-shrink-0">
              {!showTournament ? '' : '·'} {round}
            </p>
          )}
        </div>
        <p className="text-[9px] font-numbers text-[rgba(26,26,26,0.3)] flex-shrink-0 ml-2">
          {isLive ? '' : formatMatchDate(match.event_date)}
          {!isFinished && !isLive ? ` · ${match.event_time.slice(0, 5)}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => onPlayerClick({ key: match.first_player_key, name: match.event_first_player, logo: match.event_first_player_logo })}
          >
            <PlayerAvatar url={match.event_first_player_logo} name={match.event_first_player} />
            <span className={`text-[13px] flex-1 truncate leading-none ${p1Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.75)]'}`}>
              {match.event_first_player}
            </span>
          </button>
          <button
            className="flex items-center gap-2 text-left"
            onClick={() => onPlayerClick({ key: match.second_player_key, name: match.event_second_player, logo: match.event_second_player_logo })}
          >
            <PlayerAvatar url={match.event_second_player_logo} name={match.event_second_player} />
            <span className={`text-[13px] flex-1 truncate leading-none ${p2Wins ? 'font-semibold text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.75)]'}`}>
              {match.event_second_player}
            </span>
          </button>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          {(isFinished || isLive) ? (
            <SetScores scores={match.scores} />
          ) : (
            <span className="font-numbers text-sm text-[rgba(26,26,26,0.45)]">{match.event_time.slice(0, 5)}</span>
          )}
          {isLive && match.event_game_result && match.event_game_result !== '-' && (
            <div className="flex flex-col items-center min-w-[30px] bg-brand-surface px-1.5 py-1">
              <span className="font-numbers text-[11px] leading-tight text-brand-primary">{match.event_game_result.split(' - ')[0]}</span>
              <span className="font-numbers text-[11px] leading-tight text-brand-primary">{match.event_game_result.split(' - ')[1]}</span>
            </div>
          )}
        </div>
      </div>

      {isLive && (
        <div className="mt-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] tracking-[0.15em] uppercase text-red-500 font-medium">{match.event_status}</span>
        </div>
      )}
    </div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ title, badge, children }: { title: string; badge?: number; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="px-4 pb-2 flex items-center gap-2">
        <span className="font-display text-base tracking-wide text-[#1a1a1a]">{title}</span>
        {badge !== undefined && badge > 0 && (
          <span className="font-numbers text-xs text-[rgba(26,26,26,0.35)]">{badge}</span>
        )}
      </div>
      <div className="border-t border-brand-divider">{children}</div>
    </div>
  )
}

function ShowMoreBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full py-3 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] hover:text-brand-primary transition-colors border-b border-brand-divider">
      {label}
    </button>
  )
}

function EmptyState({ text }: { text: string }) {
  return <p className="px-4 py-4 text-[11px] text-[rgba(26,26,26,0.35)] italic">{text}</p>
}

// ─── Tournament group ─────────────────────────────────────────────────────────

interface TournamentGroup {
  name: string
  entries: { eventTypeKey: number; eventTypeType: string; surface: string; count: number }[]
  totalMatches: number
}

function TournamentRow({ t, onSelect }: {
  t: TournamentGroup
  onSelect: (entry: { eventTypeKey: number; eventTypeType: string }) => void
}) {
  const categories = t.entries.map((e) => typeLabel(e.eventTypeType))
  const surface = t.entries[0]?.surface

  return (
    <div className="border-b border-brand-divider last:border-0">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-[13px] font-medium text-[#1a1a1a]">{t.name}</p>
          <span className="text-[10px] font-numbers text-[rgba(26,26,26,0.35)]">{t.totalMatches} matches</span>
        </div>
        {surface && (
          <p className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.35)] mb-2">{surface}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {t.entries.map((e) => (
            <button
              key={e.eventTypeType}
              onClick={() => onSelect(e)}
              className="px-2.5 py-1 text-[9px] tracking-[0.15em] uppercase font-medium border border-brand-divider text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary transition-colors"
            >
              {typeLabel(e.eventTypeType)} draw →
            </button>
          ))}
        </div>
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
  const [tournamentsMeta, setTournamentsMeta] = useState<TournamentMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [resultsFilter, setResultsFilter] = useState<ResultsFilter>('today')
  const [showAllLive, setShowAllLive] = useState(false)
  const [showAllSchedule, setShowAllSchedule] = useState(false)
  const [showAllResults, setShowAllResults] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer | null>(null)
  const [selectedDraw, setSelectedDraw] = useState<{
    name: string; tournamentKey: number; eventTypeKey: number; eventTypeType: string
  } | null>(null)

  const loadData = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCache()
      if (cached) {
        setLiveMatches(cached.live)
        setAllFixtures(cached.fixtures)
        setTournamentsMeta(cached.tournaments ?? [])
        setLoading(false)
        return
      }
    }
    const [live, fixtures, meta] = await Promise.all([
      fetchTennis('get_livescore'),
      fetchTennis('get_fixtures', { date_start: yesterday(), date_stop: today() }),
      fetchTennis('get_tournaments'),
    ])
    const liveData = (live as TennisMatch[] | null) ?? []
    const fixturesData = (fixtures as TennisMatch[] | null) ?? []
    const metaData = (meta as TournamentMeta[] | null) ?? []
    setLiveMatches(liveData)
    setAllFixtures(fixturesData)
    setTournamentsMeta(metaData)
    writeCache(liveData, fixturesData, metaData)
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(() => loadData(true), 60_000)
    return () => clearInterval(interval)
  }, [loadData])

  // ── Derived ────────────────────────────────────────────────────────────────

  const mainLive = liveMatches.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const liveToShow = showAllLive ? liveMatches : mainLive.slice(0, PREVIEW)

  const scheduled = allFixtures.filter(
    (m) => m.event_date === today() && m.event_status === 'Not Started' && m.event_live === '0'
  )
  const mainScheduled = scheduled.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const scheduleToShow = showAllSchedule ? scheduled : mainScheduled.slice(0, PREVIEW)

  const todayFinished = allFixtures.filter((m) => m.event_date === today() && m.event_status === 'Finished')
  const allFinished = allFixtures.filter((m) => m.event_status === 'Finished')
  const mainTodayFinished = todayFinished.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const mainAllFinished = allFinished.filter((m) => MAIN_TYPES.has(m.event_type_type))
  const displayedResults = resultsFilter === 'today' ? mainTodayFinished : mainAllFinished
  const resultsToShow = showAllResults ? displayedResults : displayedResults.slice(0, PREVIEW)

  // Build tournament groups using meta for surface + event_type_key
  const metaMap = new Map<number, TournamentMeta>()
  for (const m of tournamentsMeta) metaMap.set(m.tournament_key, m)

  const groupMap = new Map<string, TournamentGroup>()
  for (const m of allFixtures) {
    if (!MAIN_TYPES.has(m.event_type_type)) continue
    const groupKey = m.tournament_name.trim()
    const meta = metaMap.get(m.tournament_key)
    const eventTypeKey = meta?.event_type_key ?? 0
    const surface = meta?.tournament_sourface ?? ''

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, { name: groupKey, entries: [], totalMatches: 0 })
    }
    const group = groupMap.get(groupKey)!
    group.totalMatches++
    const exists = group.entries.find((e) => e.eventTypeType === m.event_type_type)
    if (!exists && eventTypeKey) {
      group.entries.push({ eventTypeKey, eventTypeType: m.event_type_type, surface, count: 1 })
    } else if (exists) {
      exists.count++
    }
  }
  const tournaments = Array.from(groupMap.values())

  // ── Render ─────────────────────────────────────────────────────────────────

  const handlePlayerClick = (p: SelectedPlayer) => setSelectedPlayer(p)

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
            {liveToShow.map((m) => <MatchCard key={m.event_key} match={m} showTournament onPlayerClick={handlePlayerClick} />)}
            {!showAllLive && liveMatches.length > mainLive.slice(0, PREVIEW).length && (
              <ShowMoreBtn label={`Show all ${liveMatches.length} live matches`} onClick={() => setShowAllLive(true)} />
            )}
          </>
        )}
      </Section>

      {/* SCHEDULE */}
      <Section title="Today's schedule" badge={scheduled.length}>
        {scheduleToShow.length === 0 ? (
          <EmptyState text="No upcoming matches today" />
        ) : (
          <>
            {scheduleToShow.map((m) => <MatchCard key={m.event_key} match={m} showTournament onPlayerClick={handlePlayerClick} />)}
            {!showAllSchedule && scheduled.length > mainScheduled.slice(0, PREVIEW).length && (
              <ShowMoreBtn label={`Show all ${scheduled.length} matches`} onClick={() => setShowAllSchedule(true)} />
            )}
          </>
        )}
      </Section>

      {/* RESULTS */}
      <Section title="Results">
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
                  ? 'border-brand-primary text-brand-primary'
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
            {resultsToShow.map((m) => <MatchCard key={m.event_key} match={m} showTournament onPlayerClick={handlePlayerClick} />)}
            {!showAllResults && displayedResults.length > PREVIEW && (
              <ShowMoreBtn label={`Show all ${displayedResults.length} results`} onClick={() => setShowAllResults(true)} />
            )}
          </>
        )}
      </Section>

      {/* TOURNAMENTS */}
      {tournaments.length > 0 && (
        <Section title="Active tournaments" badge={tournaments.length}>
          {tournaments.map((t) => (
            <TournamentRow
              key={t.name}
              t={t}
              onSelect={(entry) => setSelectedDraw({
                name: t.name,
                tournamentKey: allFixtures.find(
                  (m) => m.tournament_name.trim() === t.name && m.event_type_type === entry.eventTypeType
                )?.tournament_key ?? 0,
                eventTypeKey: entry.eventTypeKey,
                eventTypeType: entry.eventTypeType,
              })}
            />
          ))}
        </Section>
      )}

      {/* Player sheet */}
      {selectedPlayer && (
        <PlayerSheet
          playerKey={selectedPlayer.key}
          name={selectedPlayer.name}
          logo={selectedPlayer.logo}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      {/* Draw sheet */}
      {selectedDraw && (
        <TournamentDrawSheet
          name={selectedDraw.name}
          tournamentKey={selectedDraw.tournamentKey}
          eventTypeKey={selectedDraw.eventTypeKey}
          eventTypeType={selectedDraw.eventTypeType}
          onClose={() => setSelectedDraw(null)}
        />
      )}
    </div>
  )
}
