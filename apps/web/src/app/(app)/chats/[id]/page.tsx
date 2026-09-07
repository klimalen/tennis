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

  // Fetch both participants' data in one query
  const { data: participantsData } = await supabase
    .from('conversation_participants')
    .select('user_id, last_read_at, profiles ( id, full_name, username, avatar_url )')
    .eq('conversation_id', id)

  const myParticipant = participantsData?.find((p) => p.user_id === user.id)
  if (!myParticipant) notFound()

  const otherParticipant = participantsData?.find((p) => p.user_id !== user.id)
  const other = (otherParticipant as unknown as { user_id: string; last_read_at: string | null; profiles: { id: string; full_name: string; username: string; avatar_url: string | null } } | undefined)
  const otherProfile = other?.profiles ?? null
  const otherLastReadAt = other?.last_read_at ?? null

  // Initial messages
  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const initialMessages = (messages ?? []) as Message[]

  // Unread count: messages from other person after my last read
  const myLastReadAt = (myParticipant as unknown as { last_read_at: string | null }).last_read_at
  const unreadCount = myLastReadAt
    ? initialMessages.filter(
        (m) => m.sender_id !== user.id && m.created_at > myLastReadAt,
      ).length
    : initialMessages.filter((m) => m.sender_id !== user.id).length

  const otherInitials = otherProfile
    ? otherProfile.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="relative flex flex-col min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/chats" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          {otherProfile && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                {otherProfile.avatar_url ? (
                  <Image src={otherProfile.avatar_url} alt={otherProfile.full_name} width={32} height={32} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-xs text-[rgba(26,26,26,0.3)]">{otherInitials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link href={`/profile/${otherProfile.username}`} className="font-display text-xl tracking-wide hover:text-brand-primary transition-colors block leading-tight truncate">
                  {otherProfile.full_name.toUpperCase()}
                </Link>
              </div>
              {unreadCount > 0 && (
                <span className="text-[9px] tracking-[0.15em] uppercase text-brand-primary font-medium border border-brand-primary px-2 py-0.5 flex-shrink-0">
                  {unreadCount} new
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <ChatView
        conversationId={id}
        userId={user.id}
        otherName={otherProfile?.full_name ?? ''}
        initialMessages={initialMessages}
        initialOtherLastReadAt={otherLastReadAt}
      />
    </div>
  )
}
