import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export interface IncomingRequest {
  id: string
  sender_id: string
  created_at: string
  sender: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
    city_name: string | null
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ requests: [] })

  const { data } = await supabase
    .from('game_requests')
    .select('id, sender_id, created_at, profiles!game_requests_sender_id_fkey ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name )')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const requests: IncomingRequest[] = (data ?? []).map((r) => ({
    id: r.id,
    sender_id: r.sender_id,
    created_at: r.created_at,
    sender: r.profiles as unknown as IncomingRequest['sender'],
  }))

  return NextResponse.json({ requests })
}
