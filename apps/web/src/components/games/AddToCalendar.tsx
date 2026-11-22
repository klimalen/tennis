'use client'

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import type { GameDetail } from '@/components/games/GameDetailSheet'
import {
  CALENDAR_STALE_NOTE,
  buildCalendarEvent,
  googleCalendarUrl,
  outlookCalendarUrl,
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

  const links = useMemo(() => {
    const event = buildCalendarEvent(calendarInput(game, viewerId, origin))
    if (!event) return null
    return {
      google: googleCalendarUrl(event),
      outlook: outlookCalendarUrl(event),
    }
  }, [game, viewerId, origin])

  if (!links) return null

  function onApple(event: MouseEvent<HTMLAnchorElement>) {
    setOpen(false)
    // iPhone and iPad open a real calendar file in the system sheet. Desktop downloads it.
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    if (ios) return
    event.preventDefault()
    const href = event.currentTarget.href
    void fetch(href).then(async (res) => {
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/calendar;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = 'tennis-game.ics'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1500)
    })
  }

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
          <a role="menuitem" href={links.google} target="_blank" rel="noopener noreferrer" className={choice} onClick={() => setOpen(false)}>
            Google Calendar
          </a>
          <a role="menuitem" href={`/api/games/${game.id}/calendar`} className={`${choice} border-t border-[#1a1a1a]/10`} onClick={onApple}>
            Apple Calendar
          </a>
          <a role="menuitem" href={links.outlook} target="_blank" rel="noopener noreferrer" className={`${choice} border-t border-[#1a1a1a]/10`} onClick={() => setOpen(false)}>
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
