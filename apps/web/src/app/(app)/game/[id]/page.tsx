import type { Metadata } from 'next'
import { GameDetailSheet } from '@/components/games/GameDetailSheet'
import { LinkState } from '@/components/share/LinkState'
import { createClient } from '@/lib/supabase/server'
import { formatPlayFormat } from '@/lib/skill'
import { isUuid, loadGameDetailRow, loadGameLinkState, viewerPlaysInGame } from '@/lib/public-game'
import { courtTitle } from '@/lib/venue-label'

function utcStamp(iso: string) {
  const dt = new Date(iso)
  const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(dt)
  const time = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'UTC' }).format(dt)
  return `${day} · ${time} UTC`
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const hidden = (title: string, description: string): Metadata => ({
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  })
  if (!isUuid(id)) return hidden('Game on GAME.', 'This game isn’t on GAME.')
  const supabase = await createClient()
  const game = await loadGameDetailRow(supabase, id)
  if (!game || game.status === 'draft' || !game.is_open) {
    const state = game?.status === 'draft' ? 'gone' : await loadGameLinkState(supabase, id)
    if (state === 'private') return hidden('Private game on GAME.', 'Sign in if you were invited.')
    return hidden('Game on GAME.', 'This game isn’t on GAME.')
  }
  const place = courtTitle(game.court?.name, game.court?.address) || game.neighborhood
  const description = [formatPlayFormat(game.format), utcStamp(game.scheduled_at), place].filter(Boolean).join(' · ')
  return {
    title: 'Open game on GAME.',
    description,
    robots: { index: false, follow: false },
    openGraph: { title: 'Open game on GAME.', description },
    twitter: { card: 'summary_large_image', title: 'Open game on GAME.', description },
  }
}

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isUuid(id)) {
    return <LinkState title="THIS GAME ISN'T ON GAME." body="The link may be old, or the game was removed." action={{ href: '/search', label: 'Find a game' }} />
  }

  const supabase = await createClient()
  const [{ data: { user } }, game] = await Promise.all([
    supabase.auth.getUser(),
    loadGameDetailRow(supabase, id),
  ])
  const viewerKind = user
    ? await supabase.from('profiles').select('account_kind').eq('id', user.id).maybeSingle()
    : null
  const viewerIsCourt = viewerKind?.data?.account_kind === 'court'

  const allowed = Boolean(game && game.status !== 'draft' && (game.is_open || viewerPlaysInGame(game, user?.id ?? null)))
  if (!game || !allowed) {
    const state = game?.status === 'draft' ? 'gone' : await loadGameLinkState(supabase, id)
    if (state === 'private') {
      return (
        <LinkState
          title="PRIVATE GAME"
          body="Sign in if you were invited. The time and place stay with the players."
          action={{ href: `/sign-in?next=${encodeURIComponent(`/game/${id}`)}`, label: 'Sign in' }}
          share={{ path: `/game/${id}`, title: 'Private game on GAME.', text: 'Private game on GAME.' }}
        />
      )
    }
    return <LinkState title="THIS GAME ISN'T ON GAME." body="The link may be old, or the game was removed." action={{ href: '/search', label: 'Find a game' }} />
  }

  return <GameDetailSheet mode="page" game={game} currentUserId={user?.id ?? null} viewerIsCourt={viewerIsCourt} />
}
