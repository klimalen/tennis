import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const city = searchParams.get('city')
  const exclude = searchParams.get('exclude')

  if (!city) {
    return NextResponse.json({ players: [] })
  }

  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name',
    )
    .is('deleted_at', null)
    .neq('full_name', '')
    .ilike('city_name', `%${city}%`)
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .limit(30)

  if (exclude) {
    query = query.neq('id', exclude)
  }

  const { data, error } = await query

  if (error) {
    console.error('Players query error:', error)
    return NextResponse.json({ players: [] })
  }

  return NextResponse.json({ players: data ?? [] })
}
