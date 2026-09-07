import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { FeedClient, type RequestItem } from './FeedClient'

interface RequestRow {
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

  const items = (requests ?? []) as unknown as RequestRow[]

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
        <FeedClient
          userId={user.id}
          initialRequests={items as RequestItem[]}
        />
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
