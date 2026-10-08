import { CourtDetailsContinue } from '@/components/court/CourtDetailsForm'

export function CourtDetailsGate() {
  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="page-header">
        <div className="mx-auto flex max-w-2xl items-end">
          <span className="font-display text-4xl tracking-wide leading-none text-[#1a1a1a]">PROFILE</span>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
        <h1 className="font-display text-4xl tracking-wide mb-1">ABOUT THE COURT</h1>
        <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)] mb-6">
          Name, city, and how players reach you
        </p>
        <CourtDetailsContinue />
      </div>
    </div>
  )
}
