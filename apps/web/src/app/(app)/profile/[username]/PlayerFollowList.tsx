import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { FollowListView, type FollowerProfile } from '@/app/(app)/me/followers/FollowersList'

export async function PlayerFollowList({
  username,
  kind,
}: {
  username: string
  kind: 'followers' | 'following'
}) {
  const supabase = await createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username')
    .eq('username', username)
    .is('deleted_at', null)
    .single()

  if (!profile) notFound()
  if (viewer && viewer.id === profile.id) {
    redirect(kind === 'followers' ? '/me/followers' : '/me/following')
  }

  const { data: rows } = kind === 'followers'
    ? await supabase
      .from('follows')
      .select('profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self, is_coach)')
      .eq('following_id', profile.id)
      .order('created_at', { ascending: false })
    : await supabase
      .from('follows')
      .select('profiles!follows_following_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self, is_coach)')
      .eq('follower_id', profile.id)
      .order('created_at', { ascending: false })

  const people = (rows ?? [])
    .map((row) => (row as { profiles: FollowerProfile | FollowerProfile[] | null }).profiles)
    .flatMap((profileRow) => (Array.isArray(profileRow) ? profileRow : profileRow ? [profileRow] : []))

  const title = kind === 'followers' ? 'FOLLOWERS' : 'FOLLOWING'
  const emptyTitle = kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'
  const emptyBody = kind === 'followers'
    ? 'People who follow this player appear here'
    : 'People this player follows appear here'

  return (
    <FollowListView
      people={people}
      title={title}
      backHref={`/profile/${profile.username}`}
      emptyTitle={emptyTitle}
      emptyBody={emptyBody}
    />
  )
}
