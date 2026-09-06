import { AuthGate } from '@/components/auth/AuthGate'
import { Newspaper } from 'lucide-react'

export default function FeedPage() {
  return (
    <AuthGate section="feed">
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-4">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-bold text-gray-900">Feed</h1>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
            <Newspaper size={28} className="text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Your tennis feed</h2>
          <p className="text-gray-500 text-sm max-w-xs">
            Match results, posts and achievements from players you follow will appear here.
          </p>
        </div>
      </div>
    </AuthGate>
  )
}
