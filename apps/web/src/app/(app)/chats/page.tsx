import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { ChatsClient, type ChatItem } from './ChatsClient'
import { ComposeButton } from './ComposeButton'
import { formatPlayFormat } from '@/lib/skill'

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
  kind: 'direct' | 'game'
  closed_at: string | null
  game: { format: string; scheduled_at: string; neighborhood: string | null; status: string } | null
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
      kind,
      closed_at,
      game:games ( format, scheduled_at, neighborhood, status ),
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

  const chats: ChatItem[] = rows.flatMap((conv): ChatItem[] => {
    const myPart = conv.conversation_participants.find((p) => p.user_id === user.id)
    const others = conv.conversation_participants.filter((p) => p.user_id !== user.id)
    const lastMsg = lastMessages.get(conv.id) ?? null
    const myLastReadAt = myPart?.last_read_at ?? null
    if (conv.kind === 'game') {
      const title = conv.game ? formatPlayFormat(conv.game.format) : 'Game'
      const names = others.map((person) => person.profiles.full_name).filter(Boolean)
      return [{
        id: conv.id,
        kind: 'game' as const,
        title,
        scheduledAt: conv.game?.scheduled_at ?? null,
        cancelled: Boolean(conv.closed_at || conv.game?.status === 'cancelled'),
        username: null,
        avatarUrl: null,
        initials: title.slice(0, 1).toUpperCase() || 'G',
        memberNames: names,
        lastMsg,
        myLastReadAt,
      }]
    }
    const otherPart = others[0]
    if (!otherPart) return []
    const name = otherPart.profiles.full_name
    return [{
      id: conv.id,
      kind: 'direct' as const,
      title: name,
      scheduledAt: null,
      cancelled: false,
      username: otherPart.profiles.username,
      avatarUrl: otherPart.profiles.avatar_url,
      initials: name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase() || '?',
      memberNames: [],
      lastMsg,
      myLastReadAt,
    }]
  })

  return <ChatsClient userId={user.id} initialChats={chats} />
}

export default async function ChatsPage() {
  return (
    <AuthGate section="chats">
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="page-header">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <span className="font-display text-4xl tracking-wide leading-none">CHATS</span>
            <ComposeButton />
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <ChatsData />
        </div>
      </div>
    </AuthGate>
  )
}
