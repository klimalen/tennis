import type { SupabaseClient } from '@supabase/supabase-js'

// Time and place changes go to the game chat. People who are only invited
// are not in that chat yet, so they still get the card in their personal chat.
export async function postGameNotice(
  supabase: SupabaseClient,
  senderId: string,
  gameId: string,
  snapshot: string,
) {
  const { data: gameChat } = await supabase
    .from('conversations')
    .select('id')
    .eq('game_id', gameId)
    .eq('kind', 'game')
    .maybeSingle()

  if (gameChat?.id) {
    await supabase.from('messages').insert({
      conversation_id: gameChat.id,
      sender_id: senderId,
      body: snapshot,
      type: 'game_invite',
      game_id: gameId,
    })
  }

  const { data: participants } = await supabase
    .from('game_participants')
    .select('player_id, status')
    .eq('game_id', gameId)
    .neq('player_id', senderId)

  for (const participant of participants ?? []) {
    if (gameChat?.id && participant.status === 'accepted') continue
    const { data: convId } = await supabase.rpc('shared_conversation_id', { other_user_id: participant.player_id })
    if (!convId) continue
    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: senderId,
      body: snapshot,
      type: 'game_invite',
      game_id: gameId,
    })
  }
}
