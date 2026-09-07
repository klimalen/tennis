import { Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function PlayerCardSkeleton() {
  return (
    <div className="bg-white rounded p-4 flex gap-3 animate-pulse">
      <div className="w-14 h-14 rounded-full bg-brand-surface-md flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-brand-surface-md rounded w-1/3" />
        <div className="h-3 bg-brand-surface rounded w-1/2" />
        <div className="h-3 bg-brand-surface rounded w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-16 bg-brand-surface rounded" />
          <div className="h-5 w-20 bg-brand-surface rounded" />
        </div>
      </div>
    </div>
  )
}

export default async function SearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-brand-surface rounded px-4 py-2.5">
            <Search size={16} className="text-[rgba(26,26,26,0.4)]" />
            <span className="text-[rgba(26,26,26,0.4)] text-sm">Players, games, courts, coaches...</span>
          </div>
          <button className="w-9 h-9 rounded bg-brand-surface flex items-center justify-center">
            <SlidersHorizontal size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 py-3 border-b border-brand-divider overflow-x-auto">
        <div className="flex gap-2 max-w-2xl mx-auto">
          {['All', 'Players', 'Open Games', 'Courts', 'Coaches'].map((filter, i) => (
            <button
              key={filter}
              className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                i === 0 ? 'bg-brand-primary text-white' : 'bg-brand-surface text-[rgba(26,26,26,0.6)] hover:bg-brand-surface-md'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* CTA banner — only for guests */}
        {!user && (
          <div className="bg-brand-primary-muted border border-brand-primary/20 rounded px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-brand-primary font-medium">
              Sign up to connect with players near you
            </p>
            <Link
              href="/sign-up"
              className="flex-shrink-0 px-4 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded hover:bg-brand-primary-dark transition-colors"
            >
              Join free
            </Link>
          </div>
        )}

        {/* Skeleton cards */}
        {[...Array(6)].map((_, i) => (
          <PlayerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}
