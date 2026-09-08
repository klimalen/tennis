import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/connections/mutual
// Returns mutual connections (both follow each other) who don't yet have a conversation with the current user.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connections: [] })

  // People I follow
  const { data: iFollow } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  if (!iFollow || iFollow.length === 0) return NextResponse.json({ connections: [] })

  const iFollowIds = iFollow.map((r) => r.following_id as string)

  // Of those, who follows me back (mutual)
  const { data: mutualRows } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', user.id)
    .in('follower_id', iFollowIds)

  if (!mutualRows || mutualRows.length === 0) return NextResponse.json({ connections: [] })

  const mutualIds = mutualRows.map((r) => r.follower_id as string)

  // Find which of those already have a conversation with me
  const { data: myConvParticipants } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  const myConvIds = (myConvParticipants ?? []).map((r) => r.conversation_id as string)

  let alreadyChatting: string[] = []
  if (myConvIds.length > 0) {
    const { data: chatPartners } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .in('conversation_id', myConvIds)
      .neq('user_id', user.id)
      .in('user_id', mutualIds)

    alreadyChatting = (chatPartners ?? []).map((r) => r.user_id as string)
  }

  const newConnectionIds = mutualIds.filter((id) => !alreadyChatting.includes(id))

  if (newConnectionIds.length === 0) return NextResponse.json({ connections: [], allChatsExist: true })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self')
    .in('id', newConnectionIds)

  return NextResponse.json({ connections: profiles ?? [], allChatsExist: false })
}
