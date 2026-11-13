import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/user'
import { CourtEditPage, mapCourtProfileToDetails } from './CourtEditPage'
import { PlayerEditPage } from './PlayerEditPage'

const PROFILE_SELECT = `
  account_kind,
  full_name, username, avatar_url, bio,
  city_name, city_lat, city_lng, address, phone, website, opening_hours,
  court_count, preferred_surfaces, has_indoor, has_outdoor, lit,
  fee_hour_min, fee_hour_max, whatsapp, instagram, telegram, facebook
`

/**
 * One server Auth + profile read, then hand off.
 * Court accounts used to pay twice: parent client getUser/profile, then
 * CourtEditPage did the same again before the form appeared.
 */
export default async function EditProfilePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', user.id)
    .single()

  if (profile?.account_kind === 'court') {
    return <CourtEditPage initial={mapCourtProfileToDetails(profile)} />
  }

  return <PlayerEditPage />
}
