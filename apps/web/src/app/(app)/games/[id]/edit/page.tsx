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
    .select('id, scheduled_at, format, neighborhood, notes, creator_id')
    .eq('id', id)
    .single()

  if (!game) notFound()

  // Load participants with profiles
  const { data: participants } = await supabase
    .from('game_participants')
    .select('player_id, status, profiles ( full_name, username, avatar_url )')
    .eq('game_id', id)

  type Participant = {
    player_id: string
    status: string
    profiles: { full_name: string; username: string; avatar_url: string | null }
  }

  return (
    <EditGameForm
      game={game}
      isCreator={game.creator_id === user.id}
      participants={(participants ?? []) as unknown as Participant[]}
    />
  )
}
