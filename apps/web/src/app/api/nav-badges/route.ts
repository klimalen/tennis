import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ feed: 0, chats: 0 })

  // Pending game requests (Feed badge)
  const { count: feedCount } = await supabase
    .from('game_requests')
    .select('*', { count: 'exact', head: true })
    .eq('receiver_id', user.id)
    .eq('status', 'pending')

  // Conversations with unread messages (Chats badge)
  // Fix: query builder is immutable — must chain .gt() before executing
  const { data: participations } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', user.id)

  let chatsCount = 0
  if (participations && participations.length > 0) {
    for (const p of participations) {
      let query = supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', p.conversation_id)
        .neq('sender_id', user.id)

      if (p.last_read_at) {
        query = query.gt('created_at', p.last_read_at)
      }

      const { count } = await query
      if ((count ?? 0) > 0) chatsCount++
    }
  }

  return NextResponse.json({ feed: feedCount ?? 0, chats: chatsCount })
}
