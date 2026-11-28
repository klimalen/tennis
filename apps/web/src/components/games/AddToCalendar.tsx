'use client'

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { GameDetail } from '@/components/games/GameDetailSheet'
import {
  CALENDAR_STALE_NOTE,
  buildCalendarEvent,
  type CalendarGameInput,
} from '@/lib/calendar-event'

const PRODUCTION_ORIGIN = 'https://www.game-tennis.space'

function calendarInput(game: GameDetail, viewerId: string, origin: string): CalendarGameInput {
  return {
    id: game.id,
    format: game.format,
    scheduledAt: game.scheduled_at,
    durationMinutes: game.duration_minutes,
    notes: game.notes,
    neighborhood: game.neighborhood,
    courtName: game.court?.name ?? null,
    courtAddress: game.court?.address ?? null,
    courtCity: game.court?.city_name?.trim() || game.city?.name || null,
    lat: game.court?.lat ?? null,
    lng: game.court?.lng ?? null,
    fee: game.court?.fee ?? null,
    courtCostCents: game.court_cost_cents,
    costCurrency: game.cost_currency ?? null,
    payment: game.payment,
    organiser: {
      id: game.creator.id,
      name: game.creator.full_name,
      accountKind: game.creator.account_kind ?? null,
    },
    players: game.participants.map((participant) => ({
      id: participant.player_id,
      name: participant.profile.full_name,
      accountKind: participant.profile.account_kind ?? null,
      status: participant.status,
    })),
    viewerId,
    pageUrl: `${origin}/game/${game.id}`,
  }
}

const choice =
  'block w-full px-4 py-3 text-left text-[13px] text-[#1a1a1a] outline-none hover:bg-brand-field focus-visible:bg-brand-field'

async function signedCalendarHref(gameId: string): Promise<string | null> {
  const res = await fetch(`/api/games/${gameId}/calendar?mint=1`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return null
  const body = (await res.json()) as { url?: unknown }
  return typeof body.url === 'string' ? body.url : null
}

/**
 * One game, one tap, like a salon booking. The calendar app still asks the
 * person to save. We never learn whether they did.
 */
export function AddToCalendar({ game, viewerId }: { game: GameDetail; viewerId: string }) {
  const menuId = useId()
  const noteId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [origin, setOrigin] = useState(PRODUCTION_ORIGIN)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    function onPointer(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open])

  const fallbackHref = `/api/games/${game.id}/calendar`
  const hrefRef = useRef(fallbackHref)
  const [fileHref, setFileHref] = useState(fallbackHref)
  const ready = useMemo(
    () => buildCalendarEvent(calendarInput(game, viewerId, origin)) !== null,
    [game, viewerId, origin],
  )

  useEffect(() => {
    let cancel = false
    hrefRef.current = fallbackHref
    setFileHref(fallbackHref)
    void signedCalendarHref(game.id).then((url) => {
      if (cancel || !url) return
      hrefRef.current = url
      setFileHref(url)
    })
    return () => {
      cancel = true
    }
  }, [game.id, fallbackHref])

  function onChoose(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault()
    setOpen(false)
    const open = (url: string) => window.open(url, '_blank', 'noopener')
    if (hrefRef.current.includes('?t=') || hrefRef.current.includes('&t=')) {
      open(hrefRef.current)
      return
    }
    void signedCalendarHref(game.id).then((url) => {
      if (!url) return
      hrefRef.current = url
      setFileHref(url)
      open(url)
    })
  }

  if (!ready) return null

  return (
    <div ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-describedby={noteId}
        onClick={() => setOpen((value) => !value)}
        className="block w-full rounded-full border border-[#1a1a1a]/20 py-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]/50"
      >
        Add to calendar
      </button>
      {open && (
        <div id={menuId} role="menu" aria-label="Add to calendar" className="mt-2 overflow-hidden rounded-2xl border border-[#1a1a1a]/10 bg-white">
          <a role="menuitem" href={fileHref} target="_blank" rel="noopener noreferrer" className={choice} onClick={onChoose}>
            Google Calendar
          </a>
          <a role="menuitem" href={fileHref} target="_blank" rel="noopener noreferrer" className={`${choice} border-t border-[#1a1a1a]/10`} onClick={onChoose}>
            Apple Calendar
          </a>
          <a role="menuitem" href={fileHref} target="_blank" rel="noopener noreferrer" className={`${choice} border-t border-[#1a1a1a]/10`} onClick={onChoose}>
            Outlook
          </a>
        </div>
      )}
      <p id={noteId} className="mt-2.5 text-center text-[11px] leading-snug text-[rgba(26,26,26,0.38)]">
        {CALENDAR_STALE_NOTE}
      </p>
    </div>
  )
}
