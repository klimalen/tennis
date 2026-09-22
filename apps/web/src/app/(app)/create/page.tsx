import { Plus } from 'lucide-react'

export default function CreatePage() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-5xl tracking-wide">CREATE</h1>
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
            className="w-full flex items-center gap-4 p-4 bg-white rounded-[28px] hover:bg-[#F4F1EC] transition-colors text-left"
          >
            <span className="text-3xl">{item.emoji}</span>
            <div>
              <p className="font-display text-2xl tracking-wide">{item.title.toUpperCase()}</p>
              <p className="font-fraunces italic text-sm text-[#85648F]">{item.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
