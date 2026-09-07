'use client'

import { useState } from 'react'
import { Plus, X, Calendar, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  /** How the trigger renders — fab for mobile center button, sidebar for desktop, schedule for inline section header */
  variant: 'fab' | 'sidebar' | 'schedule'
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
    available: false,
  },
]

export function CreateSheet({ variant }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  function handleOption(id: string) {
    setOpen(false)
    if (id === 'game') router.push('/games/new')
  }

  return (
    <>
      {/* Trigger */}
      {variant === 'fab' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-11 h-11 bg-brand-primary flex items-center justify-center shadow-lg -mt-5"
          aria-label="Create"
        >
          <Plus size={20} className="text-white" strokeWidth={2.5} />
        </button>
      ) : variant === 'schedule' ? (
        <button
          onClick={() => setOpen(true)}
          className="w-7 h-7 bg-brand-surface border border-brand-divider flex items-center justify-center hover:border-brand-primary hover:text-brand-primary transition-colors text-[rgba(26,26,26,0.4)]"
          aria-label="Add game"
        >
          <Plus size={13} strokeWidth={2} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center gap-2 w-full py-3 bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="text-xs tracking-[0.2em] uppercase font-medium">Create</span>
        </button>
      )}

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-brand-bg border-t border-brand-divider transition-transform duration-300 ease-out max-h-[90vh] flex flex-col ${
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
                  className={`w-full flex items-center gap-4 px-4 py-4 border transition-colors text-left ${
                    opt.available
                      ? 'border-brand-divider hover:border-brand-primary hover:bg-brand-surface/50'
                      : 'border-brand-divider opacity-40 cursor-not-allowed'
                  }`}
                >
                  <div className={`w-10 h-10 flex items-center justify-center flex-shrink-0 ${
                    opt.available ? 'bg-brand-surface' : 'bg-brand-surface'
                  }`}>
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
    </>
  )
}
