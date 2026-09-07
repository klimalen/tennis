import { AuthGate } from '@/components/auth/AuthGate'
import Link from 'next/link'

export default function ChatsPage() {
  return (
    <AuthGate section="chats">
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <span className="font-display text-3xl tracking-wide">CHATS</span>
          </div>
        </div>
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
      </div>
    </AuthGate>
  )
}
