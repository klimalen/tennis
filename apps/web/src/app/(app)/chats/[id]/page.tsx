import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChatView } from './ChatView'
import { formatPlayFormat } from '@/lib/skill'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'

interface RawMessage {
  id: string
  body: string
  created_at: string
  sender_id: string
  type: string
  game_id: string | null
}

interface ChatMember {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

function chatMember(person: { user_id: string; profiles: unknown }): ChatMember | null {
  const profile = person.profiles as {
    full_name?: string
    username?: string
    avatar_url?: string | null
  } | null
  if (!profile?.full_name) return null
  return {
    id: person.user_id,
    full_name: profile.full_name,
    username: profile.username ?? '',
    avatar_url: profile.avatar_url ?? null,
  }
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

  const { data: conversation } = await supabase
    .from('conversations')
    .select('kind, closed_at, game_id, game:games ( format, scheduled_at, neighborhood, status )')
    .eq('id', id)
    .maybeSingle()

  const gameRow = (conversation?.game ?? null) as {
    format: string
    scheduled_at: string
    neighborhood: string | null
    status: string
  } | null
  const isGameChat = conversation?.kind === 'game'
  const gameClosed = Boolean(conversation?.closed_at) || gameRow?.status === 'cancelled'

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

  // Personal chats need a mutual follow. A game chat is open to whoever holds a seat.
  let isMutual = true // default true to not break existing chats before follows existed
  if (!isGameChat && otherUserId) {
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
    <div className="relative flex flex-col min-h-screen">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/chats" className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          {isGameChat && (
            <div className="flex-1 min-w-0">
              <p className="text-[10px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Game chat</p>
              <span className="font-display text-xl tracking-wide block leading-tight truncate uppercase">
                {gameRow ? formatPlayFormat(gameRow.format) : 'Game'}
                {gameRow && (
                  <>
                    {' · '}
                    <LocalGameDay iso={gameRow.scheduled_at} /> <LocalGameMonth iso={gameRow.scheduled_at} />
                    {' · '}
                    <LocalGameTime iso={gameRow.scheduled_at} />
                  </>
                )}
                {gameClosed ? ' · cancelled' : ''}
              </span>
            </div>
          )}
          {!isGameChat && otherProfile && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Link href={`/profile/${otherProfile.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center flex-shrink-0">
                  {otherProfile.avatar_url ? (
                    <Image src={otherProfile.avatar_url} alt={otherProfile.full_name} width={32} height={32} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-xs text-[#1a1a1a]">{otherInitials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-display text-xl tracking-wide block leading-tight truncate">
                    {otherProfile.full_name.toUpperCase()}
                  </span>
                </div>
              </Link>
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
        {...(otherProfile?.username ? { otherUsername: otherProfile.username } : {})}
        initialMessages={initialMessages}
        initialOtherLastReadAt={isGameChat ? null : otherLastReadAt}
        initialGameStatuses={initialGameStatuses}
        initialGameDetails={initialGameDetails}
        isMutual={isGameChat ? !gameClosed : isMutual}
        gameChat={isGameChat && gameRow && conversation?.game_id ? {
          gameId: conversation.game_id,
          format: gameRow.format,
          scheduledAt: gameRow.scheduled_at,
          place: gameRow.neighborhood,
          players: (participantsData ?? [])
            .map((person) => chatMember(person)?.full_name ?? '')
            .filter(Boolean),
          members: (participantsData ?? []).flatMap((person) => {
            const member = chatMember(person)
            return member ? [member] : []
          }),
          closed: gameClosed,
        } : null}
      />
    </div>
  )
}
