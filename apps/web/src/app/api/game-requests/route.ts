import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { requestStatuses } from '@/lib/request-status'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/game-requests?receiver_ids=id1,id2
// Returns { statuses: { [receiverId]: status } } for requests sent by current user.
// Users who already share a conversation are always returned as 'matched'.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ statuses: {} })

  const ids = request.nextUrl.searchParams.get('receiver_ids')?.split(',').filter(Boolean) ?? []
  return NextResponse.json({ statuses: await requestStatuses(supabase, user.id, ids) })
}

// POST /api/game-requests  { receiver_id }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { receiver_id?: string }
  const receiverId = body.receiver_id
  if (!receiverId) return NextResponse.json({ error: 'receiver_id required' }, { status: 400 })
  if (receiverId === user.id) return NextResponse.json({ error: 'Cannot request yourself' }, { status: 400 })

  const { data: pair } = await supabase
    .from('profiles')
    .select('id, account_kind')
    .in('id', [user.id, receiverId])
  if (pair?.some((row) => row.account_kind === 'court')) {
    return NextResponse.json({ error: 'Courts do not send or receive match requests' }, { status: 400 })
  }

  // If a conversation already exists between these two users, treat as matched
  const { data: existingConvId } = await supabase
    .rpc('shared_conversation_id', { other_user_id: receiverId })
  if (existingConvId) {
    return NextResponse.json({ matched: true, conversation_id: existingConvId })
  }

  // Check if a reverse request already exists (mutual match)
  const { data: reverse } = await supabase
    .from('game_requests')
    .select('id, status')
    .eq('sender_id', receiverId)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (reverse) {
    // Mutual match — accept the reverse request and create a conversation
    const { error: updateErr } = await supabase
      .from('game_requests')
      .update({ status: 'matched' })
      .eq('id', reverse.id)

    if (updateErr) return apiError(500, 'Could not answer the request', updateErr)

    // Atomically find-or-create conversation (prevents duplicates)
    const { data: convId, error: convErr } = await supabase
      .rpc('get_or_create_conversation', { other_user_id: receiverId })

    if (convErr || !convId) return apiError(500, 'Could not open the chat', convErr)

    return NextResponse.json({ matched: true, conversation_id: convId })
  }

  // One row per pair. Re-open a declined or cancelled request instead of ignoring it.
  const { data: existing } = await supabase
    .from('game_requests')
    .select('id, status')
    .eq('sender_id', user.id)
    .eq('receiver_id', receiverId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'pending') {
      return NextResponse.json({ matched: false })
    }
    if (existing.status === 'accepted' || existing.status === 'matched') {
      return NextResponse.json({ matched: true })
    }
    const { error: reopenErr } = await supabase
      .from('game_requests')
      .update({ status: 'pending' })
      .eq('id', existing.id)
    if (reopenErr) return apiError(500, 'Could not send the request', reopenErr)
    return NextResponse.json({ matched: false })
  }

  const { error } = await supabase
    .from('game_requests')
    .insert({ sender_id: user.id, receiver_id: receiverId })

  if (error) return apiError(500, 'Could not send the request', error)

  return NextResponse.json({ matched: false })
}

// DELETE /api/game-requests?receiver_id=  — sender withdraws a pending request
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const receiverId = request.nextUrl.searchParams.get('receiver_id')
  if (!receiverId) return NextResponse.json({ error: 'receiver_id required' }, { status: 400 })

  const { error } = await supabase
    .from('game_requests')
    .update({ status: 'cancelled' })
    .eq('sender_id', user.id)
    .eq('receiver_id', receiverId)
    .eq('status', 'pending')

  if (error) return apiError(500, 'Could not update the request', error)
  return NextResponse.json({ ok: true })
}
