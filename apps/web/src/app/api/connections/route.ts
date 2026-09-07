import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// GET /api/connections — users who share a conversation with current user
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ connections: [] })

  const { data: myConvs } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  const myConvIds = (myConvs ?? []).map((c) => c.conversation_id as string)
  if (myConvIds.length === 0) return NextResponse.json({ connections: [] })

  const { data: others } = await supabase
    .from('conversation_participants')
    .select('user_id, profiles ( id, full_name, username, avatar_url )')
    .in('conversation_id', myConvIds)
    .neq('user_id', user.id)

  // Deduplicate by user_id
  const seen = new Set<string>()
  const connections = (others ?? [])
    .filter((o) => {
      if (seen.has(o.user_id)) return false
      seen.add(o.user_id)
      return true
    })
    .map((o) => (o as unknown as { user_id: string; profiles: { id: string; full_name: string; username: string; avatar_url: string | null } }).profiles)
    .filter(Boolean)

  return NextResponse.json({ connections })
}
