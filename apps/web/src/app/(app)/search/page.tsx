import { Search, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

function PlayerCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-4 flex gap-3 animate-pulse">
      <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-gray-200 rounded-full w-1/3" />
        <div className="h-3 bg-gray-100 rounded-full w-1/2" />
        <div className="h-3 bg-gray-100 rounded-full w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-16 bg-gray-100 rounded-full" />
          <div className="h-5 w-20 bg-gray-100 rounded-full" />
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
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-full px-4 py-2.5">
            <Search size={16} className="text-gray-400" />
            <span className="text-gray-400 text-sm">Players, games, courts, coaches...</span>
          </div>
          <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
            <SlidersHorizontal size={16} className="text-gray-600" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 py-3 border-b border-gray-100 overflow-x-auto">
        <div className="flex gap-2 max-w-2xl mx-auto">
          {['All', 'Players', 'Open Games', 'Courts', 'Coaches'].map((filter, i) => (
            <button
              key={filter}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                i === 0 ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
          <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-green-800 font-medium">
              Sign up to connect with players near you
            </p>
            <Link
              href="/sign-up"
              className="flex-shrink-0 px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-full hover:bg-green-700 transition-colors"
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
