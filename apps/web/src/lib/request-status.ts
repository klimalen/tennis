import type { createClient } from '@/lib/supabase/server'

type Db = Awaited<ReturnType<typeof createClient>>

// Play-request status for the signed-in user toward these players.
// A shared conversation counts as matched, same as GET /api/game-requests.
export async function requestStatuses(
  supabase: Db,
  userId: string,
  ids: string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {}

  // The Discover card only needs one player. One shared-chat lookup is enough,
  // and it runs beside the play-request read instead of after every conversation.
  if (ids.length === 1 && ids[0]) {
    const id = ids[0]
    const [{ data: request }, conv] = await Promise.all([
      supabase
        .from('game_requests')
        .select('status')
        .eq('sender_id', userId)
        .eq('receiver_id', id)
        .maybeSingle(),
      supabase.rpc('shared_conversation_id', { other_user_id: id }),
    ])
    if (!conv.error) {
      if (conv.data) return { [id]: 'matched' }
      if (request && request.status !== 'cancelled') return { [id]: request.status }
      return {}
    }
  }

  const [{ data: requests }, { data: myConvs }] = await Promise.all([
    supabase
      .from('game_requests')
      .select('receiver_id, status')
      .eq('sender_id', userId)
      .in('receiver_id', ids),
    supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', userId),
  ])

  const statuses: Record<string, string> = {}
  for (const row of requests ?? []) {
    if (row.status === 'cancelled') continue
    statuses[row.receiver_id] = row.status
  }

  if (myConvs && myConvs.length > 0) {
    const { data: sharedPartners } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .in('conversation_id', myConvs.map((row) => row.conversation_id))
      .neq('user_id', userId)
      .in('user_id', ids)

    for (const partner of sharedPartners ?? []) {
      statuses[partner.user_id] = 'matched'
    }
  }

  return statuses
}
