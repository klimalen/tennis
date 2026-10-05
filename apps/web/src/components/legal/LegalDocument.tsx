'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

export function LegalDocument({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  const router = useRouter()

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push('/sign-up')
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-16">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors"
          >
            <ChevronLeft size={20} className="text-[rgba(26,26,26,0.5)]" />
          </button>
          <span className="font-display text-5xl tracking-wide">{title}</span>
        </div>
      </div>
      <article className="max-w-2xl mx-auto px-4">
        <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)] mb-4">{updated}</p>
        <div className="bg-white rounded-[28px] px-5 py-6 space-y-6 font-copy text-sm leading-relaxed text-[rgba(26,26,26,0.75)]">
          {children}
        </div>
      </article>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl tracking-wide text-[#1a1a1a]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
