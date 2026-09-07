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

  const { data: game } = await supabase
    .from('games')
    .select('id, scheduled_at, format, neighborhood, notes, creator_id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!game) notFound()

  return <EditGameForm game={game} />
}
