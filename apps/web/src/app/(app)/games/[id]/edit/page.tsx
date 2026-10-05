import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { EditGameForm } from './EditGameForm'

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Game is visible if user is creator or participant (RLS handles this)
  const { data: game } = await supabase
    .from('games')
    .select('id, scheduled_at, duration_minutes, format, neighborhood, notes, is_open, creator_id, venue_group_id, court_cost_cents, payment, court:venue_groups!games_venue_group_id_fkey ( id, name, address, fee, lit, access )')
    .eq('id', id)
    .single()

  if (!game || game.creator_id !== user.id) notFound()

  const courtRaw = (game as { court?: { id: string; name: string | null; address: string | null; fee: boolean | null; lit: boolean | null; access: string | null } | { id: string; name: string | null; address: string | null; fee: boolean | null; lit: boolean | null; access: string | null }[] | null }).court
  const courtRow = Array.isArray(courtRaw) ? courtRaw[0] ?? null : courtRaw ?? null
  const court = courtRow ? { ...courtRow, name: courtRow.name ?? 'Tennis courts' } : null

  // Load participants with profiles
  const { data: participants } = await supabase
    .from('game_participants')
    .select('player_id, status, profiles ( full_name, username, avatar_url, account_kind )')
    .eq('game_id', id)

  type Participant = {
    player_id: string
    status: string
    profiles: { full_name: string; username: string; avatar_url: string | null; account_kind?: string | null }
  }

  const players = ((participants ?? []) as unknown as Participant[])
    .filter((participant) => participant.profiles?.account_kind !== 'court')

  return (
    <EditGameForm
      game={{ ...game, court }}
      isCreator={game.creator_id === user.id}
      participants={players}
    />
  )
}
