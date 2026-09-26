const COURT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface CourtReport {
  id: string
  name: string
  address: string
}

function clean(value: string | null | undefined, max: number) {
  return (value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

export function courtReportHref(court: { id: string; name: string; address?: string | null }) {
  const params = new URLSearchParams()
  params.set('court', court.id)
  const name = clean(court.name, 120)
  const address = clean(court.address, 180)
  if (name) params.set('name', name)
  if (address && address !== name) params.set('address', address)
  return `/settings/support?${params.toString()}`
}

export function courtReportFromSearch(params: { get(name: string): string | null }): CourtReport | null {
  const id = params.get('court') ?? ''
  if (!COURT_ID.test(id)) return null
  return {
    id,
    name: clean(params.get('name'), 120),
    address: clean(params.get('address'), 180),
  }
}

export function courtReportPreface(court: CourtReport) {
  const lines = ['Court']
  if (court.name) lines.push(court.name)
  if (court.address && court.address !== court.name) lines.push(court.address)
  lines.push(`Id: ${court.id}`)
  return lines.join('\n')
}

/** Keep the court id on the note even if the writer changes the message. */
export function withCourtReport(body: string, court: CourtReport | null, maxChars: number) {
  const note = body.trim()
  if (!court) return Array.from(note).slice(0, maxChars).join('')
  if (note.includes(court.id)) return Array.from(note).slice(0, maxChars).join('')
  const preface = courtReportPreface(court)
  const room = maxChars - Array.from(preface).length - 2
  if (room <= 0) return Array.from(preface).slice(0, maxChars).join('')
  const rest = Array.from(note).slice(0, room).join('').trim()
  return rest ? `${preface}\n\n${rest}` : preface
}
