'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Share2 } from 'lucide-react'

type Anchor = { top: number; right: number }

/** Phones and tablets put Copy inside the system sheet. Desktop sheets do not. */
function systemSheetIncludesCopy() {
  const ua = navigator.userAgent
  if (/Android|iPhone|iPod|iPad/i.test(ua)) return true
  return /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
}

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const sharing = useRef(false)
  const copiedTimer = useRef<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [manualUrl, setManualUrl] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)

  const panelOpen = menuOpen || manualUrl !== null

  function rememberAnchor() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    setAnchor({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
  }

  function closePanel() {
    setMenuOpen(false)
    setManualUrl(null)
  }

  useEffect(() => {
    if (!panelOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      closePanel()
      buttonRef.current?.focus()
    }
    function onPointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return
      closePanel()
    }
    function onLayout() {
      rememberAnchor()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, { capture: true, passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [panelOpen])

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  function absoluteUrl() {
    return `${window.location.origin}${path}`
  }

  function showCopied() {
    setCopied(true)
    closePanel()
    buttonRef.current?.focus()
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  async function copyLink() {
    const url = absoluteUrl()
    try {
      await navigator.clipboard.writeText(url)
      showCopied()
    } catch {
      rememberAnchor()
      setMenuOpen(false)
      setManualUrl(url)
    }
  }

  async function systemShare() {
    if (sharing.current || typeof navigator.share !== 'function') return
    sharing.current = true
    setMenuOpen(false)
    try {
      await navigator.share({ title, text, url: absoluteUrl() })
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      // Cancel, or a sheet that is already open. Don't replace it with another panel.
      if (name !== 'AbortError' && name !== 'InvalidStateError') await copyLink()
    } finally {
      sharing.current = false
    }
  }

  async function onShareClick() {
    if (sharing.current) return
    if (copiedTimer.current) window.clearTimeout(copiedTimer.current)
    setCopied(false)
    if (typeof navigator.share !== 'function') {
      await copyLink()
      return
    }
    if (systemSheetIncludesCopy()) {
      await systemShare()
      return
    }
    if (menuOpen) {
      closePanel()
      return
    }
    rememberAnchor()
    setManualUrl(null)
    setMenuOpen(true)
  }

  const box = size === 'sm' ? 'w-7 h-7' : 'w-9 h-9'
  const icon = size === 'sm' ? 14 : 16

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { void onShareClick() }}
        aria-label="Share"
        aria-expanded={panelOpen}
        aria-controls={panelOpen ? panelId : undefined}
        className={`${box} rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors`}
      >
        {copied
          ? <Check size={icon} className="text-[#1a1a1a]" />
          : <Share2 size={icon} className="text-[rgba(26,26,26,0.55)]" />}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
      {panelOpen && anchor ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          style={{ top: anchor.top, right: anchor.right }}
          className="fixed z-[80]"
        >
          {manualUrl ? (
            <ManualCopy url={manualUrl} onCopy={() => { void copyLink() }} />
          ) : (
            <div role="menu" aria-label="Share" className="min-w-44 overflow-hidden rounded-2xl border border-[#1a1a1a]/10 bg-white py-1 shadow-lg">
              <button type="button" role="menuitem" autoFocus onClick={() => { void copyLink() }} className="block w-full px-4 py-2.5 text-left text-[13px] text-[#1a1a1a] hover:bg-brand-field">
                Copy link
              </button>
              <button type="button" role="menuitem" onClick={() => { void systemShare() }} className="block w-full px-4 py-2.5 text-left text-[13px] text-[#1a1a1a] hover:bg-brand-field">
                Share…
              </button>
            </div>
          )}
        </div>,
        document.body,
      ) : null}
    </>
  )
}

function ManualCopy({ url, onCopy }: { url: string; onCopy: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])
  return (
    <div role="dialog" aria-label="Copy link" className="w-72 rounded-[20px] border border-[#1a1a1a]/10 bg-white p-3 shadow-lg">
      <p className="px-1 text-[10px] tracking-[0.16em] uppercase text-[rgba(26,26,26,0.45)]">Link</p>
      <input
        ref={inputRef}
        readOnly
        value={url}
        onFocus={(event) => event.currentTarget.select()}
        className="mt-2 w-full rounded-xl bg-[#F4F1EC] px-3 py-2 text-[12px] text-[#1a1a1a] outline-none"
      />
      <button type="button" onClick={onCopy} className="mt-2 w-full rounded-full bg-[#E8748A] py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#E8406A]">
        Copy link
      </button>
    </div>
  )
}
