import { costLine } from '@/lib/game-court'

/** Shown next to Add to calendar, and again where the host edits the game. */
export const CALENDAR_STALE_NOTE =
  'If this game is moved or edited, the calendar event stays as it was. Add it again, or change it there yourself.'

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
  group: 'Group',
}

export type CalendarPerson = {
  id: string
  name: string | null
  accountKind?: string | null
  status?: string | null
}

export type CalendarGameInput = {
  id: string
  format: string
  scheduledAt: string
  durationMinutes: number | null
  notes: string | null
  neighborhood: string | null
  courtName: string | null
  courtAddress: string | null
  courtCity: string | null
  lat: number | null
  lng: number | null
  fee: boolean | null
  courtCostCents: number | null
  costCurrency: string | null
  payment: string | null
  organiser: CalendarPerson | null
  players: CalendarPerson[]
  viewerId: string
  pageUrl: string
}

export type CalendarEvent = {
  title: string
  details: string
  location: string
  pageUrl: string
  start: Date
  end: Date
  geo: { lat: number; lng: number } | null
}

function finiteCoord(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null
  return value
}

/** Names of people already in the game, other than the person adding it. */
export function calendarCompanionNames(input: Pick<CalendarGameInput, 'organiser' | 'players' | 'viewerId'>): string[] {
  const names = new Map<string, string>()
  const add = (person: CalendarPerson | null, going: boolean) => {
    if (!person || !going || person.id === input.viewerId) return
    if (person.accountKind === 'court') return
    const name = person.name?.trim()
    if (!name) return
    names.set(person.id, name)
  }
  add(input.organiser, true)
  for (const player of input.players) add(player, player.status === 'accepted')
  return [...names.values()]
}

function joinNames(names: string[]): string {
  const [first, second, third] = names
  if (!first) return ''
  if (!second) return first
  if (!third) return `${first} and ${second}`
  if (names.length === 3) return `${first}, ${second} and ${third}`
  return `${first}, ${second} and ${names.length - 2} others`
}

function clampNotes(notes: string | null): string | null {
  const text = notes?.replace(/\r\n/g, '\n').trim() ?? ''
  if (!text) return null
  if (text.length <= 400) return text
  return `${text.slice(0, 399).trimEnd()}…`
}

function calendarLocation(input: CalendarGameInput): string {
  const name = input.courtName?.trim() || ''
  const address = input.courtAddress?.trim() || ''
  const city = input.courtCity?.trim() || ''
  const parts: string[] = []
  if (name) parts.push(name)
  if (address && address !== name) parts.push(address)
  if (city && !parts.some((part) => part.toLowerCase().includes(city.toLowerCase()))) parts.push(city)
  if (parts.length > 0) return parts.join(', ')
  return input.neighborhood?.trim() || ''
}

function calendarPrice(input: CalendarGameInput): string | null {
  if (input.fee === false) return 'Free'
  return costLine(input.courtCostCents, input.payment, input.costCurrency)
}

export function buildCalendarEvent(input: CalendarGameInput): CalendarEvent | null {
  const start = new Date(input.scheduledAt)
  if (Number.isNaN(start.getTime())) return null
  const minutes = input.durationMinutes && input.durationMinutes > 0 ? input.durationMinutes : 90
  const end = new Date(start.getTime() + minutes * 60_000)
  const format = FORMAT_LABELS[input.format] ?? 'Tennis'
  const withLine = joinNames(calendarCompanionNames(input))
  const title = withLine ? `Tennis · ${format} with ${withLine}` : `Tennis · ${format}`
  const details = [withLine ? `With ${withLine}` : null, calendarPrice(input), clampNotes(input.notes), input.pageUrl]
    .filter((line): line is string => Boolean(line))
    .join('\n\n')
  const lat = finiteCoord(input.lat)
  const lng = finiteCoord(input.lng)
  return {
    title,
    details,
    location: calendarLocation(input),
    pageUrl: input.pageUrl,
    start,
    end,
    geo: lat != null && lng != null ? { lat, lng } : null,
  }
}

function utcBasic(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function utcIso(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

/** Opens Google Calendar with the event filled in. Nothing is saved until the person taps Save. */
export function googleCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    details: event.details,
    location: event.location,
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}&dates=${utcBasic(event.start)}/${utcBasic(event.end)}`
}

/** Opens Outlook on the web with the event filled in. */
export function outlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: utcIso(event.start),
    enddt: utcIso(event.end),
    body: event.details,
    location: event.location,
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\n|\r/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

const utf8 = new TextEncoder()

function byteLength(value: string): number {
  return utf8.encode(value).length
}

/** Fold a content line at 75 octets, without splitting a UTF-8 character. */
function foldLine(line: string): string {
  const parts: string[] = []
  let rest = line
  let first = true
  while (rest.length > 0) {
    const budget = first ? 75 : 74
    if (byteLength(rest) <= budget) {
      parts.push(rest)
      break
    }
    let end = 0
    let bytes = 0
    for (const char of rest) {
      const size = byteLength(char)
      if (bytes + size > budget) break
      bytes += size
      end += char.length
    }
    if (end === 0) break
    parts.push(rest.slice(0, end))
    rest = rest.slice(end)
    first = false
  }
  return parts.join('\r\n ')
}

function icsLine(name: string, value: string): string {
  return foldLine(`${name}:${icsEscape(value)}`)
}

/** One event. A stable UID lets some calendar apps update a re-import, which we do not promise. */
export function buildIcs(event: CalendarEvent, gameId: string): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GAME.//Tennis//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${gameId}@game-tennis.space`,
    `DTSTAMP:${utcBasic(new Date())}`,
    `DTSTART:${utcBasic(event.start)}`,
    `DTEND:${utcBasic(event.end)}`,
    icsLine('SUMMARY', event.title),
    icsLine('DESCRIPTION', event.details),
    ...(event.location ? [icsLine('LOCATION', event.location)] : []),
    ...(event.geo ? [`GEO:${event.geo.lat};${event.geo.lng}`] : []),
    icsLine('URL', event.pageUrl),
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.join('\r\n')}\r\n`
}
