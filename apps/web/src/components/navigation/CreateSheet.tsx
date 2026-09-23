'use client'

import { useState } from 'react'
import { Plus, X, Calendar, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  /** How the trigger renders — fab for mobile center button, sidebar for desktop, schedule for inline section header */
  variant: 'fab' | 'sidebar' | 'schedule'
  /** Skip the chooser and open this screen immediately. Used by the profile section plus buttons. */
  direct?: 'game' | 'post'
}

const OPTIONS = [
  {
    id: 'game',
    icon: Calendar,
    label: 'New game',
    description: 'Schedule a game with others or just for yourself',
    available: true,
  },
  {
    id: 'post',
    icon: FileText,
    label: 'Post',
    description: 'Share a moment, result, or update',
    available: true,
  },
]

export function CreateSheet({ variant, direct }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function openCreate(id: 'game' | 'post') {
    router.push(id === 'game' ? '/games/new' : '/feed/new')
  }

  function handleOption(id: string) {
    setOpen(false)
    if (id === 'game' || id === 'post') openCreate(id)
  }

  function handleTrigger() {
    if (direct) {
      openCreate(direct)
      return
    }
    setOpen(true)
  }

  return (
    <>
      {/* Trigger */}
      {variant === 'fab' ? (
        <button
          onClick={handleTrigger}
          className="relative -mt-6 h-14 w-14 rounded-full transition-transform active:scale-95"
          aria-label="Create"
        >
          <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden>
            <circle cx="32" cy="32" r="28" fill="#D4E040" stroke="#1a1a1a" strokeWidth="2.5" />
            <path d="M20 14c10 6 10 30 0 36" fill="none" stroke="#1a1a1a" strokeWidth="2.25" strokeLinecap="round" />
            <path d="M44 14c-10 6-10 30 0 36" fill="none" stroke="#1a1a1a" strokeWidth="2.25" strokeLinecap="round" />
          </svg>
        </button>
      ) : variant === 'schedule' ? (
        <button
          onClick={handleTrigger}
          className="w-7 h-7 rounded-full bg-brand-field border border-[#1a1a1a]/40 flex items-center justify-center hover:border-[#1a1a1a]/60 transition-colors text-[#1a1a1a]"
          aria-label={direct === 'post' ? 'Add post' : 'Add game'}
        >
          <Plus size={13} strokeWidth={2} />
        </button>
      ) : (
        <button
          onClick={handleTrigger}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A] transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="text-xs tracking-[0.2em] uppercase font-medium">Create</span>
        </button>
      )}

      {!direct && open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {!direct && (
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-[28px] transition-transform duration-300 ease-out max-h-[90vh] flex flex-col ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="max-w-lg mx-auto w-full px-4 pt-4 pb-6 overflow-y-auto flex-1">
          {/* Handle + header */}
          <div className="flex items-center justify-between mb-5">
            <span className="font-display text-2xl tracking-wide">CREATE</span>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.4)] hover:text-[#1a1a1a] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Options */}
          <div className="space-y-2">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.id}
                  onClick={() => opt.available && handleOption(opt.id)}
                  disabled={!opt.available}
                  className={`w-full flex items-center gap-4 px-4 py-4 rounded-[28px] transition-colors text-left ${
                    opt.available
                      ? 'bg-brand-field hover:bg-[#CFC4B6]'
                      : 'bg-brand-field opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0">
                    <Icon size={18} className={opt.available ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1a1a1a] flex items-center gap-2">
                      {opt.label}
                      {!opt.available && (
                        <span className="text-[8px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.3)] border border-[rgba(26,26,26,0.15)] px-1.5 py-0.5">
                          Soon
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">{opt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      )}
    </>
  )
}
