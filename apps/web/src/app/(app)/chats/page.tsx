import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'

interface LastMessage {
  id: string
  body: string
  created_at: string
  sender_id: string
}

interface ConversationRow {
  id: string
  created_at: string
  conversation_participants: {
    user_id: string
    profiles: {
      id: string
      full_name: string
      username: string
      avatar_url: string | null
    }
  }[]
}

async function ChatsList() {
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
        profiles (
          id, full_name, username, avatar_url
        )
      )
    `)
    .order('created_at', { ascending: false })

  const rows = (conversations ?? []) as unknown as ConversationRow[]

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">No chats yet</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          When someone accepts your game request, a chat will open here.
        </p>
        <Link
          href="/search"
          className="mt-6 px-6 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
        >
          Find players
        </Link>
      </div>
    )
  }

  // Fetch last message for each conversation
  const lastMessages = new Map<string, LastMessage>()
  await Promise.all(
    rows.map(async (conv) => {
      const { data } = await supabase
        .from('messages')
        .select('id, body, created_at, sender_id')
        .eq('conversation_id', conv.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) lastMessages.set(conv.id, data as LastMessage)
    }),
  )

  const chats = rows.map((conv) => {
    const other = conv.conversation_participants.find((p) => p.user_id !== user.id)
    return {
      id: conv.id,
      other: other?.profiles ?? null,
      lastMsg: lastMessages.get(conv.id) ?? null,
    }
  }).filter((c) => c.other !== null)

  return (
    <div>
      {chats.map(({ id, other, lastMsg }) => {
        if (!other) return null
        const initials = other.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
        const preview = lastMsg
          ? (lastMsg.sender_id === user.id ? 'You: ' : '') + lastMsg.body
          : null

        return (
          <Link
            key={id}
            href={`/chats/${id}`}
            className="flex items-center gap-4 px-4 py-4 border-b border-brand-divider hover:bg-brand-surface/50 transition-colors"
          >
            <div className="w-12 h-12 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
              {other.avatar_url ? (
                <Image src={other.avatar_url} alt={other.full_name} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-lg text-[rgba(26,26,26,0.3)]">{initials}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base tracking-wide leading-tight">{other.full_name.toUpperCase()}</p>
              {preview ? (
                <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5 truncate">{preview}</p>
              ) : (
                <p className="text-[10px] tracking-[0.1em] text-[rgba(26,26,26,0.3)] mt-0.5">@{other.username}</p>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
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
          <ChatsList />
        </div>
      </div>
    </AuthGate>
  )
}
