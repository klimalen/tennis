import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/game-requests/:id  { action: 'accept' | 'decline', sender_id }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { action?: string; sender_id?: string }
  const { action, sender_id } = body

  if (action !== 'accept' && action !== 'decline') {
    return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 })
  }

  // Verify this user is the receiver
  const { data: req, error: fetchErr } = await supabase
    .from('game_requests')
    .select('id, sender_id, receiver_id, status')
    .eq('id', id)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .single()

  if (fetchErr || !req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (action === 'decline') {
    await supabase.from('game_requests').update({ status: 'declined' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // Accept — update status and create conversation
  const { error: updateErr } = await supabase
    .from('game_requests')
    .update({ status: 'accepted' })
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ request_id: id })
    .select('id')
    .single()

  if (convErr || !conv) return NextResponse.json({ error: convErr?.message ?? 'Failed to create conversation' }, { status: 500 })

  const actualSenderId = sender_id ?? req.sender_id
  await supabase.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: user.id },
    { conversation_id: conv.id, user_id: actualSenderId },
  ])

  return NextResponse.json({ ok: true, conversation_id: conv.id })
}
