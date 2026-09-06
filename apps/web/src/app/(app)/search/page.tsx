import { Search, SlidersHorizontal } from 'lucide-react'

export default function SearchPage() {
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
                i === 0
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <Search size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Find your next game</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Search for players to match with, open games to join, courts to book, or coaches to train with.
        </p>
      </div>
    </div>
  )
}
