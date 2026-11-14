import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/user'
import { AuthGate } from '@/components/auth/AuthGate'
import { notFound } from 'next/navigation'
import { FollowListView, type FollowerProfile } from './FollowersList'

async function FollowersContent() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return notFound()

  const { data: rows } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self, is_coach)')
    .eq('following_id', user.id)
    .order('created_at', { ascending: false })

  const followers = (rows ?? []).map((r) => r.profiles as unknown as FollowerProfile).filter(Boolean)

  return (
    <FollowListView
      people={followers}
      title="FOLLOWERS"
      backHref="/me"
      emptyTitle="No followers yet"
      emptyBody="When someone follows you, they appear here"
    />
  )
}

export default function FollowersPage() {
  return (
    <AuthGate section="me">
      <FollowersContent />
    </AuthGate>
  )
}
