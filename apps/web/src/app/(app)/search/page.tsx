import { createClient } from '@/lib/supabase/server'
import { SearchClient } from './SearchClient'
import type { IncomingRequest } from '@/app/api/game-requests/incoming/route'

export default async function SearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let cityName: string | null = null
  let initialIncoming: IncomingRequest[] = []

  if (user) {
    const [{ data: profile }, { data: requestRows }] = await Promise.all([
      supabase
        .from('profiles')
        .select('city_name')
        .eq('id', user.id)
        .single(),
      supabase
        .from('game_requests')
        .select('id, sender_id, created_at, profiles!game_requests_sender_id_fkey ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name )')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    cityName = profile?.city_name ?? null
    initialIncoming = (requestRows ?? []).map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      created_at: r.created_at,
      sender: r.profiles as IncomingRequest['sender'],
    }))
  }

  return <SearchClient user={user} userCityName={cityName} initialIncoming={initialIncoming} />
}
