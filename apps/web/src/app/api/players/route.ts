import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadPlayers } from '@/lib/load-players'

const SKILL_FILTERS = new Set(['Beginner', 'Intermediate', 'Advanced', 'Competitive'])

function selectedSkills(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((part) => part.trim()).filter((part) => SKILL_FILTERS.has(part))
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const latStr = searchParams.get('lat')
  const lngStr = searchParams.get('lng')
  const lat = latStr ? parseFloat(latStr) : null
  const lng = lngStr ? parseFloat(lngStr) : null

  const supabase = await createClient()
  const result = await loadPlayers(supabase, {
    city: searchParams.get('city'),
    lat: lat !== null && !Number.isNaN(lat) ? lat : null,
    lng: lng !== null && !Number.isNaN(lng) ? lng : null,
    exclude: searchParams.get('exclude'),
    offset: Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10)),
    q: (searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80),
    skills: selectedSkills(searchParams.get('skill')),
    coachesOnly: searchParams.get('coach') === '1',
  })

  return NextResponse.json(result)
}
