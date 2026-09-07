import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export interface OpenGameProfile {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
}

export interface OpenGameParticipant {
  player_id: string
  status: string
  profile: OpenGameProfile
}

export interface OpenGame {
  id: string
  scheduled_at: string
  format: string
  neighborhood: string | null
  notes: string | null
  creator_id: string
  max_players: number
  creator: OpenGameProfile & { city_name: string | null }
  participants: OpenGameParticipant[]
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ games: [] })

  const city = request.nextUrl.searchParams.get('city')

  const { data, error } = await supabase
    .from('games')
    .select(`
      id, scheduled_at, format, neighborhood, notes, creator_id, max_players,
      creator:profiles!games_creator_id_fkey ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name ),
      game_participants ( player_id, status, profiles ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed ) )
    `)
    .eq('is_open', true)
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(50)

  if (error) {
    console.error('[GET /api/open-games] error:', error)
    return NextResponse.json({ games: [] })
  }

  const rows = data ?? []

  const filtered = city
    ? rows.filter((r) => {
        const c = r.creator as unknown as { city_name: string | null }
        return c.city_name?.toLowerCase().includes(city.toLowerCase())
      })
    : rows

  const games: OpenGame[] = filtered.map((r) => {
    const participants: OpenGameParticipant[] = (r.game_participants ?? []).map((p) => ({
      player_id: p.player_id,
      status: p.status,
      profile: p.profiles as unknown as OpenGameProfile,
    }))
    return {
      id: r.id,
      scheduled_at: r.scheduled_at,
      format: r.format,
      neighborhood: r.neighborhood ?? null,
      notes: r.notes ?? null,
      creator_id: r.creator_id,
      max_players: r.max_players,
      creator: r.creator as unknown as OpenGame['creator'],
      participants,
    }
  })

  return NextResponse.json({ games })
}
