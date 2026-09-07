import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChatView } from './ChatView'

interface Message {
  id: string
  body: string
  created_at: string
  sender_id: string
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Verify participant
  const { data: membership } = await supabase
    .from('conversation_participants')
    .select('user_id')
    .eq('conversation_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership) notFound()

  // Other participant
  const { data: others } = await supabase
    .from('conversation_participants')
    .select('profiles ( id, full_name, username, avatar_url )')
    .eq('conversation_id', id)
    .neq('user_id', user.id)

  const other = (others?.[0] as unknown as { profiles: { id: string; full_name: string; username: string; avatar_url: string | null } } | undefined)?.profiles ?? null

  // Initial messages (server-rendered)
  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (messages ?? []) as Message[]

  const otherInitials = other
    ? other.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="flex flex-col min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/chats" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          {other && (
            <>
              <div className="w-8 h-8 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center">
                {other.avatar_url ? (
                  <Image src={other.avatar_url} alt={other.full_name} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-xs text-[rgba(26,26,26,0.3)]">{otherInitials}</span>
                )}
              </div>
              <Link href={`/profile/${other.username}`} className="font-display text-xl tracking-wide hover:text-brand-primary transition-colors">
                {other.full_name.toUpperCase()}
              </Link>
            </>
          )}
        </div>
      </div>

      <ChatView
        conversationId={id}
        userId={user.id}
        initialMessages={initialMessages}
      />
    </div>
  )
}
