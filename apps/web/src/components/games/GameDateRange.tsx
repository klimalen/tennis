'use client'

import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export interface DayRange {
  start: string
  end: string
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

function parseKey(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

function toKey(dt: Date) {
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

function todayKey() {
  return toKey(new Date())
}

function shiftMonth(year: number, month: number, delta: number) {
  const next = new Date(year, month + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() }
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - startOffset)
  const cells: { key: string; day: number; inMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const dt = new Date(gridStart)
    dt.setDate(gridStart.getDate() + i)
    cells.push({ key: toKey(dt), day: dt.getDate(), inMonth: dt.getMonth() === month })
  }
  const lastWeek = cells.slice(35)
  if (lastWeek.every((cell) => !cell.inMonth)) return cells.slice(0, 35)
  return cells
}

export function formatDayRange(range: DayRange | null) {
  if (!range) return null
  const start = parseKey(range.start)
  const end = parseKey(range.end)
  if (range.start === range.end) {
    return start.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
  }
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  if (sameMonth) {
    const month = start.toLocaleDateString('en-GB', { month: 'short' })
    return `${start.getDate()}–${end.getDate()} ${month}`
  }
  const left = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const right = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${left} – ${right}`
}

function chipLabel(range: DayRange | null) {
  if (!range) return null
  if (range.start === range.end) {
    return parseKey(range.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }
  return formatDayRange(range)
}

export function GameDateRange({
  value,
  onChange,
  markedDays,
}: {
  value: DayRange | null
  onChange: (value: DayRange | null) => void
  markedDays: ReadonlySet<string>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DayRange | null>(value)
  const [awaitingEnd, setAwaitingEnd] = useState(false)
  const [cursor, setCursor] = useState(() => {
    const seed = value ? parseKey(value.start) : new Date()
    return { year: seed.getFullYear(), month: seed.getMonth() }
  })

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function openWidget() {
    const next = value
    setDraft(next)
    setAwaitingEnd(false)
    const seed = next ? parseKey(next.start) : new Date()
    setCursor({ year: seed.getFullYear(), month: seed.getMonth() })
    setOpen(true)
  }

  function pick(key: string) {
    if (key < todayKey()) return
    if (!draft || !awaitingEnd) {
      setDraft({ start: key, end: key })
      setAwaitingEnd(true)
      return
    }
    const start = key < draft.start ? key : draft.start
    const end = key < draft.start ? draft.start : key
    setDraft({ start, end })
    setAwaitingEnd(false)
  }

  const today = todayKey()
  const cells = monthCells(cursor.year, cursor.month)
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const label = chipLabel(value)
  const active = value != null
  const draftLabel = formatDayRange(draft)

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openWidget())}
        aria-expanded={open}
        aria-label={label ? `Dates ${label}` : 'Choose dates'}
        className={`flex flex-shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors ${
          active
            ? 'border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F2]'
            : 'border-[#1a1a1a]/15 bg-brand-field text-[#1a1a1a]'
        }`}
      >
        <Calendar size={13} strokeWidth={1.75} />
        {label}
      </button>
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[22vh] sm:pt-[18vh]">
          <button type="button" aria-label="Close dates" className="absolute inset-0 bg-[#1a1a1a]/25" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-[22rem] rounded-[28px] border border-[#1a1a1a]/10 bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-field"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="font-display text-3xl leading-none tracking-wide uppercase">{monthLabel}</p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-brand-field"
              >
                <ChevronRight size={16} />
              </button>
            </div>
            <p className="mt-2 text-center font-fraunces text-sm italic text-[#497250]">
              {awaitingEnd ? 'Now tap the last day' : 'Tap the first day, then the last'}
            </p>
            <div className="mt-3 grid grid-cols-7 gap-y-1">
              {WEEKDAYS.map((day) => (
                <span key={day} className="pb-1 text-center text-[10px] font-medium uppercase tracking-[0.08em] text-[rgba(26,26,26,0.4)]">{day}</span>
              ))}
              {cells.map((cell) => {
                const past = cell.key < today
                const endpoint = draft != null && (cell.key === draft.start || cell.key === draft.end)
                const inside = draft != null && cell.key > draft.start && cell.key < draft.end
                const marked = markedDays.has(cell.key)
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={past}
                    onClick={() => pick(cell.key)}
                    className={`relative flex h-10 items-center justify-center text-sm ${past ? 'cursor-default text-[rgba(26,26,26,0.25)]' : 'text-[#1a1a1a]'} ${cell.inMonth ? '' : 'text-[rgba(26,26,26,0.35)]'}`}
                  >
                    {inside && <span className="absolute inset-y-1 left-0 right-0 bg-[#F0EBE3]" />}
                    {endpoint && draft?.start !== draft?.end && cell.key === draft?.start && <span className="absolute inset-y-1 left-1/2 right-0 bg-[#F0EBE3]" />}
                    {endpoint && draft?.start !== draft?.end && cell.key === draft?.end && <span className="absolute inset-y-1 left-0 right-1/2 bg-[#F0EBE3]" />}
                    <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${endpoint ? 'bg-[#E8748A] font-medium' : ''}`}>
                      {cell.day}
                    </span>
                    {marked && !past && (
                      <span className={`absolute bottom-1 h-1 w-1 rounded-full ${endpoint ? 'bg-[#1a1a1a]' : 'bg-[#3A8A7A]'}`} />
                    )}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 min-h-5 text-center text-[11px] uppercase tracking-[0.14em] text-[rgba(26,26,26,0.55)]">
              {draftLabel ?? 'Any date'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { onChange(null); setOpen(false) }}
                className="flex-1 rounded-full py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#1a1a1a] hover:bg-brand-field"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={!draft}
                onClick={() => { if (draft) onChange(draft); setOpen(false) }}
                className="flex-1 rounded-full bg-[#E8748A] py-3 text-[11px] font-medium uppercase tracking-[0.14em] text-[#1a1a1a] hover:bg-[#E8406A] disabled:opacity-40"
              >
                Show
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
