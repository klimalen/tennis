import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/game-requests?receiver_ids=id1,id2
// Returns { statuses: { [receiverId]: status } } for requests sent by current user
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ statuses: {} })

  const ids = request.nextUrl.searchParams.get('receiver_ids')?.split(',').filter(Boolean) ?? []
  if (ids.length === 0) return NextResponse.json({ statuses: {} })

  const { data } = await supabase
    .from('game_requests')
    .select('receiver_id, status')
    .eq('sender_id', user.id)
    .in('receiver_id', ids)

  const statuses: Record<string, string> = {}
  for (const row of data ?? []) {
    statuses[row.receiver_id] = row.status
  }

  return NextResponse.json({ statuses })
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

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // Create conversation — generate UUID upfront to avoid SELECT-after-INSERT RLS issue
    const convId = crypto.randomUUID()

    const { error: convErr } = await supabase
      .from('conversations')
      .insert({ id: convId, request_id: reverse.id })

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })

    await supabase.from('conversation_participants').insert([
      { conversation_id: convId, user_id: user.id },
      { conversation_id: convId, user_id: receiverId },
    ])

    return NextResponse.json({ matched: true, conversation_id: convId })
  }

  // No reverse — upsert a pending request (ignore if already sent)
  const { error } = await supabase
    .from('game_requests')
    .upsert({ sender_id: user.id, receiver_id: receiverId }, { onConflict: 'sender_id,receiver_id', ignoreDuplicates: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ matched: false })
}
