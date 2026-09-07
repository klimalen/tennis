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

  // Verify this user is the receiver and request is still pending
  const { data: req, error: fetchErr } = await supabase
    .from('game_requests')
    .select('id, sender_id, receiver_id, status')
    .eq('id', id)
    .eq('receiver_id', user.id)
    .single()

  if (fetchErr || !req) {
    return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  }

  if (action === 'decline') {
    await supabase.from('game_requests').update({ status: 'declined' }).eq('id', id)
    return NextResponse.json({ ok: true })
  }

  // --- Accept ---

  // Idempotent: if already accepted, look for existing conversation
  if (req.status === 'accepted') {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('request_id', id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ ok: true, conversation_id: existing.id })
    }
    // Conversation was never created — fall through to create it
  }

  // Update status
  const { error: updateErr } = await supabase
    .from('game_requests')
    .update({ status: 'accepted' })
    .eq('id', id)

  if (updateErr) {
    console.error('[game-requests PATCH] update error:', updateErr)
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Create conversation
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ request_id: id })
    .select('id')
    .single()

  if (convErr || !conv) {
    console.error('[game-requests PATCH] conversation insert error:', convErr)
    return NextResponse.json({ error: convErr?.message ?? 'Failed to create conversation' }, { status: 500 })
  }

  // Add both participants
  const actualSenderId = sender_id ?? req.sender_id
  const { error: participantsErr } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: actualSenderId },
    ])

  if (participantsErr) {
    console.error('[game-requests PATCH] participants insert error:', participantsErr)
    // Conversation exists, return it — participants can be retried
  }

  return NextResponse.json({ ok: true, conversation_id: conv.id })
}
