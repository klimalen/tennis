export type CourtPayment = 'split' | 'host' | 'at_court'

export interface GameCourt {
  id: string
  name: string
  address: string | null
  lit: boolean | null
  fee: boolean | null
  access: string | null
  phone: string | null
  website: string | null
  google_maps_uri: string | null
  lat: number | null
  lng: number | null
}

export const PAYMENT_OPTIONS: { value: CourtPayment; label: string; hint: string }[] = [
  { value: 'split', label: 'Split', hint: 'Divide the court between players' },
  { value: 'host', label: 'Host pays', hint: 'The host covers the hour' },
  { value: 'at_court', label: 'Pay at the court', hint: 'Each player pays on site' },
]

const MAX_CENTS = 100_000

export function formatCourtCost(cents: number | null | undefined): string | null {
  if (cents == null) return null
  if (cents === 0) return 'Free'
  const dollars = cents / 100
  const text = Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)
  return `$${text}`
}

export function paymentLabel(payment: string | null | undefined): string | null {
  if (payment === 'split') return 'Split'
  if (payment === 'host') return 'Host pays'
  if (payment === 'at_court') return 'Pay at the court'
  return null
}

export function costLine(cents: number | null | undefined, payment: string | null | undefined): string | null {
  const cost = formatCourtCost(cents)
  if (!cost) return null
  if (cents === 0) return 'Free'
  const how = paymentLabel(payment)
  return how ? `${cost} · ${how}` : cost
}

/** How you get on court. Unknown fee stays blank rather than guessing. */
export function arrivalLabel(court: { fee: boolean | null; access: string | null } | null | undefined): string | null {
  if (!court) return null
  const closed = court.access === 'private' || court.access === 'members'
  if (court.fee === false && !closed) return 'Just show up'
  if (court.fee === true || closed) return 'Book or call ahead'
  return null
}

export function lightsLabel(lit: boolean | null | undefined): string | null {
  if (lit === true) return 'Lights'
  if (lit === false) return 'No lights'
  return null
}

export function courtPlaceName(court: { name: string } | null | undefined, fallback: string | null | undefined): string | null {
  const name = court?.name?.trim()
  if (name) return name
  const text = fallback?.trim()
  return text || null
}

/** Second line under the court name. Skip it when it repeats the name. */
export function courtPlaceDetail(
  court: { name: string; address: string | null } | null | undefined,
  fallback: string | null | undefined,
): string | null {
  if (court?.address?.trim() && court.address.trim() !== court.name.trim()) return court.address.trim()
  if (!court) return null
  const text = fallback?.trim()
  if (text && text !== court.name.trim()) return text
  return null
}

export function parseCourtOffer(
  costCents: unknown,
  payment: unknown,
  venueFee: boolean | null,
): { court_cost_cents: number | null; payment: CourtPayment | null; error: string | null } {
  if (venueFee === false) {
    return { court_cost_cents: 0, payment: null, error: null }
  }

  if (costCents == null || costCents === '') {
    return { court_cost_cents: null, payment: null, error: null }
  }

  const cents = typeof costCents === 'number' ? costCents : Number(costCents)
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) {
    return { court_cost_cents: null, payment: null, error: 'Enter a court price up to $1000' }
  }
  if (cents === 0) {
    return { court_cost_cents: 0, payment: null, error: null }
  }

  if (payment !== 'split' && payment !== 'host' && payment !== 'at_court') {
    return { court_cost_cents: null, payment: null, error: 'Choose how players pay for the court' }
  }
  return { court_cost_cents: cents, payment, error: null }
}

export function dollarsToCents(dollars: string): number | null {
  const trimmed = dollars.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}
