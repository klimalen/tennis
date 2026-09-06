import { Plus } from 'lucide-react'

export default function CreatePage() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-bold text-gray-900">Create</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        {[
          { emoji: '🎾', title: 'New Game', desc: 'Invite a player or create an open game' },
          { emoji: '📢', title: 'Open Game', desc: 'Create a game anyone can join' },
          { emoji: '📝', title: 'Post', desc: 'Share a photo, video or match result' },
        ].map((item) => (
          <button
            key={item.title}
            className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-100 hover:border-green-200 hover:bg-green-50/30 transition-colors text-left"
          >
            <span className="text-3xl">{item.emoji}</span>
            <div>
              <p className="font-semibold text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
