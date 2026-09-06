import { AuthGate } from '@/components/auth/AuthGate'
import { Grid3X3, Trophy, BarChart3, Settings } from 'lucide-react'

export default function MePage() {
  return (
    <AuthGate section="me">
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">Me</h1>
            <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <Settings size={16} className="text-gray-600" />
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto">
          <div className="px-4 pt-6 pb-4">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border-2 border-gray-200">
                <span className="text-3xl">👤</span>
              </div>
              <div className="flex-1 flex items-center justify-around pt-2">
                {[{ value: '0', label: 'Matches' }, { value: '0', label: 'Wins' }, { value: '—', label: 'Rating' }].map((stat) => (
                  <div key={stat.label} className="flex flex-col items-center">
                    <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                    <span className="text-xs text-gray-500">{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="h-4 w-32 bg-gray-100 rounded mb-1" />
              <div className="h-3 w-24 bg-gray-100 rounded mb-2" />
              <button className="w-full py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                Edit profile
              </button>
            </div>
          </div>
          <div className="border-t border-gray-100">
            <div className="flex">
              {[{ icon: Grid3X3 }, { icon: Trophy }, { icon: BarChart3 }].map((tab, i) => {
                const Icon = tab.icon
                return (
                  <button key={i} className={`flex-1 flex flex-col items-center py-3 border-b-2 transition-colors ${i === 0 ? 'border-gray-900' : 'border-transparent text-gray-400'}`}>
                    <Icon size={20} />
                  </button>
                )
              })}
            </div>
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                <Grid3X3 size={24} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-1">No posts yet</p>
              <p className="text-xs text-gray-500">Share your first match or photo</p>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  )
}
