import { ImageResponse } from 'next/og'
import { shareCard } from '@/components/share/share-card'
import { createClient } from '@/lib/supabase/server'
import { skillLabel } from '@/lib/skill'

export const alt = 'Profile on GAME.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function ProfileImage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const missing = shareCard({ kicker: 'Profile', title: 'Profile', line: 'This profile isn’t on GAME.' })
  const supabase = await createClient()
  const profile = await loadShareProfile(supabase, username)
  if (!profile) return new ImageResponse(missing, { ...size })

  const isCourt = profile.account_kind === 'court'
  const level = isCourt || profile.is_coach ? null : skillLabel(profile.skill_level_computed ?? profile.skill_level_self)
  return new ImageResponse(
    shareCard({
      kicker: isCourt ? 'Court' : 'Player',
      title: profile.full_name,
      line: profile.city_name,
      pill: level,
    }),
    { ...size },
  )
}

async function loadShareProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  username: string,
) {
  const fields = 'full_name, username, city_name, account_kind, is_coach, skill_level_self, skill_level_computed'
  const direct = await supabase.from('profiles').select(fields).eq('username', username).is('deleted_at', null).maybeSingle()
  if (direct.data) return direct.data
  const { data: nextName } = await supabase.rpc('profile_slug_redirect', { slug: username })
  if (typeof nextName !== 'string' || !nextName || nextName === username) return null
  const redirected = await supabase.from('profiles').select(fields).eq('username', nextName).is('deleted_at', null).maybeSingle()
  return redirected.data
}
