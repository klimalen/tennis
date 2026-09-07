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

  for (const inviteeId of userIds) {
    // Add as participant if not already
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

    // Find shared conversation via SECURITY DEFINER function (bypasses RLS)
    const { data: convId, error: convErr } = await supabase
      .rpc('shared_conversation_id', { other_user_id: inviteeId })

    if (convErr) console.error('[invite] shared_conversation_id error:', convErr)
    if (!convId) {
      console.error('[invite] no shared conversation for invitee', inviteeId)
      continue
    }

    // Check if game_invite already sent for this game in this conversation
    const { data: existingMsg } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', convId)
      .eq('game_id', gameId)
      .maybeSingle()

    if (existingMsg) continue

    // Send game_invite message
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      body: snapshot,
      type: 'game_invite',
      game_id: gameId,
    })
    if (msgErr) console.error('[invite] message insert error:', msgErr)
  }

  return NextResponse.json({ ok: true })
}
