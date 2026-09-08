import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// POST /api/conversations  { other_user_id }
// Atomically finds or creates a 1:1 conversation. Returns { conversation_id }.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { other_user_id?: string }
  const { other_user_id } = body
  if (!other_user_id) return NextResponse.json({ error: 'other_user_id required' }, { status: 400 })
  if (other_user_id === user.id) return NextResponse.json({ error: 'Cannot chat with yourself' }, { status: 400 })

  const { data: convId, error } = await supabase
    .rpc('get_or_create_conversation', { other_user_id })

  if (error || !convId) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 })

  return NextResponse.json({ conversation_id: convId })
}
