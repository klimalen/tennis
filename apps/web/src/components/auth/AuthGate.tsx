import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface AuthGateProps {
  children: React.ReactNode
  section: 'feed' | 'schedule' | 'me' | 'chats'
}

const SECTION_CONTENT = {
  feed: {
    emoji: '💬',
    title: 'Your tennis community awaits',
    description: 'Share match results, follow players and stay connected with your local tennis scene.',
  },
  schedule: {
    emoji: '📅',
    title: 'Never miss a game',
    description: 'Games you create or join show up here.',
  },
  me: {
    emoji: '🎾',
    title: 'Build your tennis profile',
    description: 'Track your progress, showcase your stats and connect with players at your level.',
  },
  chats: {
    emoji: '💬',
    title: 'Your chats',
    description: 'Accept game requests to start chatting with other players.',
  },
}

function MockContent() {
  return (
    <div className="p-4 space-y-4 pointer-events-none select-none" aria-hidden>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="bg-white rounded border border-brand-divider p-4 flex gap-3">
          <div className="w-12 h-12 rounded-full bg-brand-surface-md flex-shrink-0" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 bg-brand-surface-md rounded w-2/3" />
            <div className="h-3 bg-brand-surface rounded w-full" />
            <div className="h-3 bg-brand-surface rounded w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export async function AuthGate({ children, section }: AuthGateProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) return <>{children}</>

  const content = SECTION_CONTENT[section]

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="blur-sm opacity-60">
        <MockContent />
      </div>
      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="bg-white rounded-[28px] p-8 text-center max-w-sm w-full">
          <div className="text-4xl mb-4 text-brand-accent">✦</div>
          <h2 className="font-display text-3xl tracking-wide text-[#1a1a1a] mb-2">{content.title}</h2>
          <p className="text-sm text-[rgba(26,26,26,0.55)] mb-6">{content.description}</p>
          <div className="space-y-3">
            <Link
              href="/sign-up"
              className="block w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-semibold hover:bg-[#E8406A] transition-colors text-sm"
            >
              Create free account
            </Link>
            <Link
              href="/sign-in"
              className="block w-full py-3 rounded-full border border-[#1a1a1a]/15 text-[#1a1a1a] font-semibold hover:bg-[#FAF7F2] transition-colors text-sm"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
