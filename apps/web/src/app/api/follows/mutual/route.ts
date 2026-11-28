import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/follows/mutual
// Every player the current user follows who follows them back.
// Invite lists use this. A shared chat is not required.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ friends: [] })

  const { data: outgoing } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)

  const followingIds = (outgoing ?? []).map((row) => row.following_id as string)
  if (followingIds.length === 0) return NextResponse.json({ friends: [] })

  const { data: incoming } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('following_id', user.id)
    .in('follower_id', followingIds)

  const mutualIds = (incoming ?? []).map((row) => row.follower_id as string)
  if (mutualIds.length === 0) return NextResponse.json({ friends: [] })

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url, account_kind')
    .in('id', mutualIds)
    .is('deleted_at', null)
    .order('full_name')

  const friends = (profiles ?? []).filter((profile) => profile.account_kind !== 'court')

  return NextResponse.json({ friends })
}
