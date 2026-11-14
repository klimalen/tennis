import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/user'
import { AuthGate } from '@/components/auth/AuthGate'
import { notFound } from 'next/navigation'
import { FollowListView, type FollowerProfile } from '../followers/FollowersList'

async function FollowingContent() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return notFound()

  const { data: rows } = await supabase
    .from('follows')
    .select('following_id, profiles!follows_following_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self, is_coach)')
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false })

  const following = (rows ?? []).map((r) => r.profiles as unknown as FollowerProfile).filter(Boolean)

  return (
    <FollowListView
      people={following}
      title="FOLLOWING"
      backHref="/me"
      emptyTitle="Not following anyone yet"
      emptyBody="People you follow appear here"
    />
  )
}

export default function FollowingPage() {
  return (
    <AuthGate section="me">
      <FollowingContent />
    </AuthGate>
  )
}
