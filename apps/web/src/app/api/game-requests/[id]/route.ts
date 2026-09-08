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

  const actualSenderId = sender_id ?? req.sender_id

  // Check if conversation already exists between this pair (idempotent, dedup guard)
  const { data: existingConvId } = await supabase
    .rpc('shared_conversation_id', { other_user_id: actualSenderId })
  if (existingConvId) {
    return NextResponse.json({ ok: true, conversation_id: existingConvId })
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

  // Atomically find-or-create conversation (prevents duplicates)
  const { data: convId, error: convErr } = await supabase
    .rpc('get_or_create_conversation', { other_user_id: actualSenderId })

  if (convErr || !convId) {
    console.error('[game-requests PATCH] conversation error:', convErr)
    return NextResponse.json({ error: convErr?.message ?? 'Failed to create conversation' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, conversation_id: convId })
}
