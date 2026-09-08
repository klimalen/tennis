import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChatView } from './ChatView'

interface RawMessage {
  id: string
  body: string
  created_at: string
  sender_id: string
  type: string
  game_id: string | null
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
  const otherUserId = other?.user_id ?? ''

  const { data: messages } = await supabase
    .from('messages')
    .select('id, body, created_at, sender_id, type, game_id')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const rawMessages = (messages ?? []) as RawMessage[]
  const initialMessages = rawMessages.map((m) => ({
    ...m,
    type: m.type as 'text' | 'game_invite',
    game_id: m.game_id,
  }))

  // Load participant statuses for all game_invite messages
  const gameIds = rawMessages
    .filter((m) => m.type === 'game_invite' && m.game_id)
    .map((m) => m.game_id as string)

  const initialGameStatuses: Record<string, { myStatus: 'invited' | 'accepted' | 'declined' | 'creator'; otherStatus: 'invited' | 'accepted' | 'declined' | null }> = {}

  type GameDetail = { id: string; scheduled_at: string; format: string; neighborhood: string | null; creator_id: string }
  const initialGameDetails: Record<string, GameDetail> = {}

  if (gameIds.length > 0) {
    const [{ data: participants }, { data: games }] = await Promise.all([
      supabase
        .from('game_participants')
        .select('game_id, player_id, status')
        .in('game_id', gameIds)
        .in('player_id', [user.id, otherUserId].filter(Boolean)),
      supabase
        .from('games')
        .select('id, scheduled_at, format, neighborhood, creator_id')
        .in('id', gameIds),
    ])

    for (const gameId of gameIds) {
      const gameParticipants = (participants ?? []).filter((p) => p.game_id === gameId)
      const mine = gameParticipants.find((p) => p.player_id === user.id)
      const theirs = gameParticipants.find((p) => p.player_id === otherUserId)
      const game = (games ?? []).find((g) => g.id === gameId)

      const isCreator = game?.creator_id === user.id

      initialGameStatuses[gameId] = {
        myStatus: isCreator ? 'creator' : (mine?.status as 'invited' | 'accepted' | 'declined') ?? 'invited',
        otherStatus: (theirs?.status as 'invited' | 'accepted' | 'declined') ?? null,
      }

      if (game) initialGameDetails[gameId] = game as GameDetail
    }
  }

  // Check mutual follow — messaging requires both to follow each other
  let isMutual = true // default true to not break existing chats before follows existed
  if (otherUserId) {
    const [{ data: f1 }, { data: f2 }] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('follower_id', user.id).eq('following_id', otherUserId).maybeSingle(),
      supabase.from('follows').select('follower_id').eq('follower_id', otherUserId).eq('following_id', user.id).maybeSingle(),
    ])
    // If either side has no follows at all yet, allow messaging (legacy chats before follows feature)
    const followsExist = !!(f1 ?? f2)
    isMutual = followsExist ? !!(f1 && f2) : true
  }

  const myLastReadAt = (myParticipant as unknown as { last_read_at: string | null }).last_read_at
  const unreadCount = myLastReadAt
    ? initialMessages.filter((m) => m.sender_id !== user.id && m.created_at > myLastReadAt).length
    : initialMessages.filter((m) => m.sender_id !== user.id).length

  const otherInitials = otherProfile
    ? otherProfile.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="relative flex flex-col min-h-screen pb-20 md:pb-0">
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
        otherUserId={otherUserId}
        otherName={otherProfile?.full_name ?? ''}
        initialMessages={initialMessages}
        initialOtherLastReadAt={otherLastReadAt}
        initialGameStatuses={initialGameStatuses}
        initialGameDetails={initialGameDetails}
        isMutual={isMutual}
      />
    </div>
  )
}
