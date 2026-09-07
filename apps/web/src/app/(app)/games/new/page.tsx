import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function NewGamePage() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/me" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">NEW GAME</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-32 px-6 text-center">
        <p className="font-display text-5xl text-brand-surface-lg mb-4">✦</p>
        <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-2">Coming soon</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] font-script italic">
          Game scheduling is on its way.
        </p>
      </div>
    </div>
  )
}
