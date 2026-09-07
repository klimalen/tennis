import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { ChatsClient, type ChatItem } from './ChatsClient'

interface ParticipantRow {
  user_id: string
  last_read_at: string | null
  profiles: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
  }
}

interface ConversationRow {
  id: string
  created_at: string
  conversation_participants: ParticipantRow[]
}

async function ChatsData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: conversations } = await supabase
    .from('conversations')
    .select(`
      id,
      created_at,
      conversation_participants (
        user_id,
        last_read_at,
        profiles ( id, full_name, username, avatar_url )
      )
    `)
    .order('created_at', { ascending: false })

  const rows = (conversations ?? []) as unknown as ConversationRow[]
  if (rows.length === 0) return <ChatsClient userId={user.id} initialChats={[]} />

  // Fetch last message for each conversation
  const lastMessages = new Map<string, ChatItem['lastMsg']>()
  await Promise.all(
    rows.map(async (conv) => {
      const { data } = await supabase
        .from('messages')
        .select('id, body, created_at, sender_id, type')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) lastMessages.set(conv.id, data as ChatItem['lastMsg'])
    }),
  )

  const chats: ChatItem[] = rows
    .map((conv) => {
      const myPart = conv.conversation_participants.find((p) => p.user_id === user.id)
      const otherPart = conv.conversation_participants.find((p) => p.user_id !== user.id)
      if (!otherPart) return null
      return {
        id: conv.id,
        other: otherPart.profiles,
        lastMsg: lastMessages.get(conv.id) ?? null,
        myLastReadAt: myPart?.last_read_at ?? null,
      }
    })
    .filter((c): c is ChatItem => c !== null)

  return <ChatsClient userId={user.id} initialChats={chats} />
}

export default async function ChatsPage() {
  return (
    <AuthGate section="chats">
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <span className="font-display text-3xl tracking-wide">CHATS</span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <ChatsData />
        </div>
      </div>
    </AuthGate>
  )
}
