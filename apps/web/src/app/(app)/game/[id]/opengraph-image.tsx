import { ImageResponse } from 'next/og'
import { shareCard } from '@/components/share/share-card'
import { createClient } from '@/lib/supabase/server'
import { holdsGameSeat } from '@/lib/schedule'
import { formatPlayFormat } from '@/lib/skill'
import { isUuid, loadGameDetailRow, loadGameLinkState } from '@/lib/public-game'
import { courtTitle } from '@/lib/venue-label'

export const alt = 'Open game on GAME.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function utcStamp(iso: string) {
  const dt = new Date(iso)
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(dt)
  return `${day} · ${time} UTC`
}

export default async function GameImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const missing = shareCard({ kicker: 'Game', title: 'Game', line: 'This game isn’t on GAME.' })
  if (!isUuid(id)) return new ImageResponse(missing, { ...size })

  const supabase = await createClient()
  const game = await loadGameDetailRow(supabase, id)
  if (!game || game.status === 'draft' || !game.is_open) {
    const state = await loadGameLinkState(supabase, id)
    const card = state === 'private'
      ? shareCard({ kicker: 'Game', title: 'Private game', line: 'Sign in if you were invited.' })
      : missing
    return new ImageResponse(card, { ...size })
  }

  const accepted = game.participants.filter((participant) => holdsGameSeat(participant.status) && participant.profile.account_kind !== 'court')
  const past = new Date(game.scheduled_at).getTime() < Date.now()
  const full = accepted.length >= game.max_players
  const pill = game.status === 'cancelled' ? 'Cancelled' : past ? 'Played' : full ? 'Full' : null
  const place = courtTitle(game.court?.name, game.court?.address) || game.neighborhood
  return new ImageResponse(
    shareCard({
      kicker: 'Open game',
      title: formatPlayFormat(game.format) || 'Game',
      line: [utcStamp(game.scheduled_at), place].filter(Boolean).join(' · '),
      pill,
    }),
    { ...size },
  )
}
