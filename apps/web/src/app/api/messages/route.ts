import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/messages  { conversation_id, body }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { conversation_id?: string; body?: string }
  const { conversation_id, body: text } = body

  if (!conversation_id || !text?.trim()) {
    return NextResponse.json({ error: 'conversation_id and body required' }, { status: 400 })
  }

  // Verify participant
  const { data: membership } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', conversation_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id, sender_id: user.id, body: text.trim() })
    .select('id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.id, created_at: data.created_at })
}
