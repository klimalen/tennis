import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import { GameRequestActions } from './GameRequestActions'

interface RequestWithSender {
  id: string
  created_at: string
  sender: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
    city_name: string | null
  }
}

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}

async function FeedContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: requests } = await supabase
    .from('game_requests')
    .select(`
      id,
      created_at,
      sender:sender_id (
        id, full_name, username, avatar_url,
        skill_level_self, skill_level_computed, city_name
      )
    `)
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  const items = (requests ?? []) as unknown as RequestWithSender[]

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-3xl tracking-wide">FEED</span>
          {items.length > 0 && (
            <span className="text-[9px] tracking-[0.2em] uppercase text-brand-primary font-medium">
              {items.length} request{items.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">All quiet here</p>
            <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
              Game requests and activity from other players will appear here.
            </p>
          </div>
        ) : (
          <div>
            <p className="px-4 pt-5 pb-2 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">
              Game requests
            </p>
            {items.map((req) => {
              const s = req.sender
              const rating = s.skill_level_computed ?? s.skill_level_self
              const initials = s.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

              return (
                <div key={req.id} className="px-4 py-4 border-b border-brand-divider">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <Link href={`/profile/${s.username}`} className="w-12 h-12 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                      {s.avatar_url ? (
                        <Image src={s.avatar_url} alt={s.full_name} width={48} height={48} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-lg text-[rgba(26,26,26,0.3)]">{initials}</span>
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <Link href={`/profile/${s.username}`} className="block font-display text-base tracking-wide leading-tight hover:text-brand-primary transition-colors">
                        {s.full_name.toUpperCase()}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        {rating && (
                          <span className="text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-1.5 py-0.5">
                            {SKILL_LABELS[Math.round(rating * 2) / 2] ?? rating}
                          </span>
                        )}
                        {s.city_name && (
                          <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{s.city_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <GameRequestActions requestId={req.id} senderId={s.id} />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default async function FeedPage() {
  return (
    <AuthGate section="feed">
      <FeedContent />
    </AuthGate>
  )
}
