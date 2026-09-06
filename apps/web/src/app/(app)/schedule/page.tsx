import { CalendarDays } from 'lucide-react'

export default function SchedulePage() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Schedule</h1>
          <span className="text-sm text-gray-500">September 2026</span>
        </div>
      </div>

      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
          <CalendarDays size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">No games yet</h2>
        <p className="text-gray-500 text-sm max-w-xs">
          Your upcoming games and court bookings will appear here.
        </p>
        <button className="mt-6 px-5 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-full hover:bg-green-700 transition-colors">
          Find a game
        </button>
      </div>
    </div>
  )
}
