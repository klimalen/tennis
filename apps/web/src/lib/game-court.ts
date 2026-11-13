export type CourtPayment = 'split' | 'host' | 'at_court'
export type CourtCurrency = 'USD' | 'EUR'

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
  surface?: string | null
  surfaces?: string[] | null
  court_count?: number | null
  has_indoor?: boolean | null
  has_outdoor?: boolean | null
  fee_hour_min?: number | null
  fee_hour_max?: number | null
  city_name?: string | null
  opening_hours?: string | null
  /** Present when this catalog court is linked to a court account profile. */
  profile_username?: string | null
}

export const PAYMENT_OPTIONS: { value: CourtPayment; label: string; hint: string }[] = [
  { value: 'split', label: 'Split', hint: 'Players divide this total between themselves' },
  { value: 'host', label: 'Host pays', hint: 'The host covers this total' },
  { value: 'at_court', label: 'Pay at the court', hint: 'Players pay this total at the court' },
]

export const CURRENCY_OPTIONS: { value: CourtCurrency; symbol: string; label: string }[] = [
  { value: 'USD', symbol: '$', label: 'USD' },
  { value: 'EUR', symbol: '€', label: 'EUR' },
]

const MAX_CENTS = 100_000

export function currencySymbol(currency: CourtCurrency | string | null | undefined): string {
  return currency === 'EUR' ? '€' : '$'
}

export function parseCourtCurrency(value: unknown): CourtCurrency | null {
  if (value === 'USD' || value === 'EUR') return value
  return null
}

export function formatCourtCost(
  cents: number | null | undefined,
  currency: CourtCurrency | string | null | undefined = 'USD',
): string | null {
  if (cents == null) return null
  if (cents === 0) return 'Free'
  const amount = cents / 100
  const text = Number.isInteger(amount) ? String(amount) : amount.toFixed(2)
  return `${currencySymbol(currency)}${text}`
}

export function paymentLabel(payment: string | null | undefined): string | null {
  if (payment === 'split') return 'Split'
  if (payment === 'host') return 'Host pays'
  if (payment === 'at_court') return 'Pay at the court'
  return null
}

export function costLine(
  cents: number | null | undefined,
  payment: string | null | undefined,
  currency: CourtCurrency | string | null | undefined = 'USD',
): string | null {
  const cost = formatCourtCost(cents, currency)
  if (!cost) return null
  if (cents === 0) return 'Free'
  const how = paymentLabel(payment)
  const total = `${cost} total`
  return how ? `${total} · ${how}` : total
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
  currency: unknown = 'USD',
): {
  court_cost_cents: number | null
  payment: CourtPayment | null
  cost_currency: CourtCurrency | null
  error: string | null
} {
  if (venueFee === false) {
    return { court_cost_cents: 0, payment: null, cost_currency: null, error: null }
  }

  if (costCents == null || costCents === '') {
    return { court_cost_cents: null, payment: null, cost_currency: null, error: null }
  }

  const cents = typeof costCents === 'number' ? costCents : Number(costCents)
  if (!Number.isInteger(cents) || cents < 0 || cents > MAX_CENTS) {
    return { court_cost_cents: null, payment: null, cost_currency: null, error: 'Enter a court price up to 1000' }
  }
  if (cents === 0) {
    return { court_cost_cents: 0, payment: null, cost_currency: null, error: null }
  }

  const costCurrency = parseCourtCurrency(currency) ?? 'USD'
  if (payment !== 'split' && payment !== 'host' && payment !== 'at_court') {
    return { court_cost_cents: null, payment: null, cost_currency: null, error: 'Choose how players pay for the court' }
  }
  return { court_cost_cents: cents, payment, cost_currency: costCurrency, error: null }
}

export function dollarsToCents(dollars: string): number | null {
  const trimmed = dollars.trim()
  if (!trimmed) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 100)
}
