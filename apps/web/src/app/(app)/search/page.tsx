import { createClient } from '@/lib/supabase/server'
import { loadDiscoverPlayer } from '@/lib/load-players'
import { SearchClient, type Player } from './SearchClient'
import type { IncomingRequest } from '@/app/api/game-requests/incoming/route'

export default async function SearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let cityName: string | null = null
  let cityLat: number | null = null
  let cityLng: number | null = null
  let initialIncoming: IncomingRequest[] = []
  let initialPreviewPlayer: Player | null = null
  let initialRequestStatuses: Record<string, string> = {}
  let previewPlayerReady = false

  if (user) {
    const [{ data: profile }, { data: requestRows }, preview] = await Promise.all([
      supabase
        .from('profiles')
        .select('city_name, city_lat, city_lng')
        .eq('id', user.id)
        .single(),
      supabase
        .from('game_requests')
        .select('id, sender_id, created_at, profiles!game_requests_sender_id_fkey ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name )')
        .eq('receiver_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      loadDiscoverPlayer(supabase, user.id),
    ])
    initialPreviewPlayer = preview.player as Player | null
    initialRequestStatuses = preview.statuses
    previewPlayerReady = preview.ready

    cityName = profile?.city_name ?? null
    cityLat = profile?.city_lat ?? null
    cityLng = profile?.city_lng ?? null
    initialIncoming = (requestRows ?? []).map((r) => ({
      id: r.id,
      sender_id: r.sender_id,
      created_at: r.created_at,
      sender: r.profiles as unknown as IncomingRequest['sender'],
    }))
  }

  return (
    <SearchClient
      user={user}
      userCityName={cityName}
      userCityLat={cityLat}
      userCityLng={cityLng}
      initialIncoming={initialIncoming}
      initialPreviewPlayer={initialPreviewPlayer}
      initialRequestStatuses={initialRequestStatuses}
      previewPlayerReady={previewPlayerReady}
    />
  )
}
