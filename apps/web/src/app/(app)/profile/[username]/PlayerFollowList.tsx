import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FollowersList, type FollowerProfile } from '@/app/(app)/me/followers/FollowersList'

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
      .select('profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self)')
      .eq('following_id', profile.id)
      .order('created_at', { ascending: false })
    : await supabase
      .from('follows')
      .select('profiles!follows_following_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self)')
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
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/profile/${profile.username}`} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-3xl tracking-wide">{title}</span>
          <span className="text-[rgba(26,26,26,0.35)] text-sm font-numbers">{people.length}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {people.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">{emptyTitle}</p>
            <p className="text-xs font-fraunces italic text-[#85648F]">{emptyBody}</p>
          </div>
        ) : (
          <FollowersList followers={people} />
        )}
      </div>
    </div>
  )
}
