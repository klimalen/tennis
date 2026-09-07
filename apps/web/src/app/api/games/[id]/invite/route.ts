import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/games/:id/invite  { user_ids: string[] }
// Adds each user as 'invited' participant and sends a game_invite message in their shared chat
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: gameId } = await params
  const body = await request.json() as { user_ids?: string[] }
  const userIds = body.user_ids ?? []

  if (userIds.length === 0) return NextResponse.json({ ok: true })

  // Verify game exists and current user is creator
  const { data: game } = await supabase
    .from('games')
    .select('id, scheduled_at, format, neighborhood')
    .eq('id', gameId)
    .eq('creator_id', user.id)
    .single()

  if (!game) return NextResponse.json({ error: 'Game not found' }, { status: 404 })

  // Build message body (snapshot shown on card)
  const snapshot = JSON.stringify({
    scheduled_at: game.scheduled_at,
    format: game.format,
    location: game.neighborhood ?? null,
  })

  // Get all conversations the current user is in
  const { data: myConvs, error: convErr } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', user.id)

  if (convErr) console.error('[invite] myConvs error:', convErr)

  const myConvIds = (myConvs ?? []).map((c) => c.conversation_id as string)
  console.log('[invite] myConvIds count:', myConvIds.length)

  for (const inviteeId of userIds) {
    // Skip if already a participant
    const { data: existing } = await supabase
      .from('game_participants')
      .select('player_id')
      .eq('game_id', gameId)
      .eq('player_id', inviteeId)
      .maybeSingle()

    if (!existing) {
      const { error: pErr } = await supabase
        .from('game_participants')
        .insert({ game_id: gameId, player_id: inviteeId, status: 'invited' })
      if (pErr) console.error('[invite] participant insert error:', pErr)
    }

    // Find shared conversation
    if (myConvIds.length === 0) {
      console.error('[invite] no conversations for user', user.id)
      continue
    }

    const { data: sharedConv, error: sharedErr } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', inviteeId)
      .in('conversation_id', myConvIds)
      .maybeSingle()

    if (sharedErr) console.error('[invite] sharedConv error:', sharedErr)

    if (!sharedConv) {
      console.error('[invite] no shared conversation for invitee', inviteeId)
      continue
    }

    // Check if game_invite already sent in this conversation for this game
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', sharedConv.conversation_id)
      .eq('game_id', gameId)
      .maybeSingle()

    if (existingMsg) {
      console.log('[invite] message already sent, skipping')
      continue
    }

    // Send game_invite message
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: sharedConv.conversation_id,
      sender_id: user.id,
      body: snapshot,
      type: 'game_invite',
      game_id: gameId,
    })
    if (msgErr) console.error('[invite] message insert error:', msgErr)
    else console.log('[invite] message sent to conv', sharedConv.conversation_id)
  }

  return NextResponse.json({ ok: true })
}
