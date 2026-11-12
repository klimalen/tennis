'use client'

import { useEffect, useId, useState } from 'react'
import { Check, Share2 } from 'lucide-react'

export function ShareLinkButton({
  path,
  title,
  text,
  size = 'md',
}: {
  path: string
  title: string
  text: string
  size?: 'sm' | 'md'
}) {
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const box = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function absoluteUrl() {
    return `${window.location.origin}${path}`
  }

  async function share() {
    const url = absoluteUrl()
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url })
        setOpen(false)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    setCopied(false)
    setOpen(true)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl())
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { void share() }}
        aria-label="Share"
        aria-expanded={open}
        aria-controls={panelId}
        className={`${box} rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors`}
      >
        <Share2 size={size === 'sm' ? 14 : 16} className="text-[rgba(26,26,26,0.55)]" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close share" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div id={panelId} role="dialog" aria-label="Copy link" className="absolute right-0 top-full z-50 mt-2 w-72 rounded-[20px] border border-[#1a1a1a]/10 bg-white p-3 shadow-lg">
            <p className="px-1 text-[10px] tracking-[0.16em] uppercase text-[rgba(26,26,26,0.45)]">Link</p>
            <input readOnly value={absoluteUrl()} onFocus={(event) => event.currentTarget.select()} className="mt-2 w-full rounded-xl bg-[#F4F1EC] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none" />
            <button
              type="button"
              onClick={() => { void copy() }}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-[#E8748A] py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]"
            >
              {copied ? <Check size={12} /> : null}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
