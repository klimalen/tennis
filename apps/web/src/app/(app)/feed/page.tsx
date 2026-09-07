import { AuthGate } from '@/components/auth/AuthGate'

export default function FeedPage() {
  return (
    <AuthGate section="feed">
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <span className="font-display text-3xl tracking-wide">FEED</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">Your tennis feed</p>
          <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
            Match results, posts and achievements from players you follow will appear here.
          </p>
        </div>
      </div>
    </AuthGate>
  )
}
