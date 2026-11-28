'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  arrivalLabel,
  CURRENCY_OPTIONS,
  currencySymbol,
  dollarsToCents,
  lightsLabel,
  PAYMENT_OPTIONS,
  type CourtCurrency,
  type CourtPayment,
} from '@/lib/game-court'
import { Check, MapPin, Search, Star } from 'lucide-react'
import { FormNote, FormSectionLabel, gameFormChoiceClass, gameFormPanel, gameFormWell } from '@/components/games/WhenFields'
import { TRAVEL_RADIUS_KM, haversineKm } from '@/lib/travel'

export interface CourtPick {
  id: string
  name: string
  address: string | null
  fee: boolean | null
  lit: boolean | null
  access: string | null
}

export interface CourtPlaceValue {
  venueId: string | null
  venue: CourtPick | null
  locationName: string
  courtCostCents: number | null
  /** Present when a price is set; ignored for Free. */
  costCurrency: CourtCurrency | null
  payment: CourtPayment | null
}

interface VenueResult extends CourtPick {
  kind?: string
}

const EMPTY: CourtPlaceValue = {
  venueId: null,
  venue: null,
  locationName: '',
  courtCostCents: null,
  costCurrency: null,
  payment: null,
}

export function emptyCourtPlace(): CourtPlaceValue {
  return { ...EMPTY }
}

function centsToDollars(cents: number | null): string {
  if (cents == null || cents === 0) return ''
  const dollars = cents / 100
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2)
}

async function fetchCourts(lat: number, lng: number, q: string): Promise<VenueResult[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(TRAVEL_RADIUS_KM),
    q,
  })
  const res = await fetch(`/api/venues?${params.toString()}`)
  if (!res.ok) return []
  const json = await res.json() as { venues?: VenueResult[] }
  return json.venues ?? []
}

// The profile stores one point for the city name. "Austin" can be the Minnesota
// town while the catalog is Austin, Texas. Resolve that once, then every query
// searches the city that actually has courts.
async function resolveCourtAnchor(
  coords: { lat: number; lng: number } | null,
  cityName: string | null,
): Promise<{ lat: number; lng: number } | null> {
  if (coords) {
    const near = await fetchCourts(coords.lat, coords.lng, '')
    if (near.length > 0) return coords
  }
  if (!cityName) return coords
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=5`,
    { headers: { 'Accept-Language': 'en' } },
  )
  if (!res.ok) return coords
  const places = await res.json() as { lat: string; lon: string }[]
  for (const place of places) {
    const lat = Number(place.lat)
    const lng = Number(place.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (coords && haversineKm(coords.lat, coords.lng, lat, lng) < 20) continue
    const venues = await fetchCourts(lat, lng, '')
    if (venues.length > 0) return { lat, lng }
  }
  return coords
}

export function CourtPlaceFields({
  value,
  onChange,
  locked = false,
}: {
  value: CourtPlaceValue
  onChange: (next: CourtPlaceValue) => void
  /** When true (court host creating a game), show their court only — no search/change. */
  locked?: boolean
}) {
  const [favorites, setFavorites] = useState<VenueResult[]>([])
  const [results, setResults] = useState<VenueResult[]>([])
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState(value.venueId == null && value.locationName.length > 0)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [placeReady, setPlaceReady] = useState(false)
  const [anchor, setAnchor] = useState<{ lat: number; lng: number } | null>(null)
  const [anchorReady, setAnchorReady] = useState(false)
  const [searching, setSearching] = useState(false)
  const [dollars, setDollars] = useState(centsToDollars(value.courtCostCents))
  const [pricing, setPricing] = useState((value.courtCostCents ?? 0) > 0)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setPlaceReady(true)
        return
      }
      const { data } = await supabase.from('profiles').select('city_name, city_lat, city_lng').eq('id', user.id).maybeSingle()
      if (data?.city_lat != null && data.city_lng != null) {
        setCoords({ lat: data.city_lat, lng: data.city_lng })
      }
      setCityName(data?.city_name?.trim() || null)
      setPlaceReady(true)
    })
    void fetch('/api/court-favorites')
      .then((res) => res.json() as Promise<{ venues?: VenueResult[] }>)
      .then((json) => setFavorites(json.venues ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!placeReady) return
    let cancelled = false
    void (async () => {
      const point = await resolveCourtAnchor(coords, cityName)
      if (cancelled) return
      setAnchor(point)
      setAnchorReady(true)
    })()
    return () => { cancelled = true }
  }, [placeReady, coords, cityName])

  useEffect(() => {
    if (custom || value.venue) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    if (!anchorReady) return
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        if (!anchor) {
          if (!cancelled) {
            setResults([])
            setSearching(false)
          }
          return
        }
        setSearching(true)
        const found = await fetchCourts(anchor.lat, anchor.lng, q)
        if (cancelled) return
        setResults(found)
        setSearching(false)
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [anchor, anchorReady, query, custom, value.venue])

  function selectVenue(venue: VenueResult) {
    const free = venue.fee === false
    onChange({
      venueId: venue.id,
      venue,
      locationName: '',
      courtCostCents: free ? 0 : value.courtCostCents,
      costCurrency: free ? null : (value.costCurrency ?? 'USD'),
      payment: free ? null : value.payment,
    })
    if (free) {
      setDollars('')
      setPricing(false)
    }
    setCustom(false)
  }

  function clearVenue() {
    onChange({
      venueId: null,
      venue: null,
      locationName: '',
      courtCostCents: value.courtCostCents,
      costCurrency: value.costCurrency,
      payment: value.payment,
    })
    setCustom(false)
  }

  function chooseFree() {
    setPricing(false)
    onChange({ ...value, courtCostCents: 0, costCurrency: null, payment: null })
    setDollars('')
  }

  function chooseAmount(nextDollars: string) {
    setDollars(nextDollars)
    const cents = dollarsToCents(nextDollars)
    const priced = Boolean(cents && cents > 0)
    onChange({
      ...value,
      courtCostCents: priced ? cents : null,
      costCurrency: priced ? (value.costCurrency ?? 'USD') : null,
      payment: priced ? value.payment : null,
    })
  }

  function chooseCurrency(next: CourtCurrency) {
    onChange({
      ...value,
      costCurrency: (value.courtCostCents ?? 0) > 0 || pricing ? next : value.costCurrency,
    })
  }

  const lockedFree = value.venue?.fee === false
  const priced = !lockedFree && value.courtCostCents != null && value.courtCostCents > 0

  const needle = query.trim().toLowerCase()
  const typing = needle.length > 0
  const favoriteIds = new Set(favorites.map((venue) => venue.id))
  const matchedFavorites = typing
    ? favorites.filter((venue) => `${venue.name} ${venue.address ?? ''}`.toLowerCase().includes(needle))
    : []
  const listed = results.filter((venue) => !favoriteIds.has(venue.id))
  const shownResults = listed.slice(0, 8)
  const hasRows = typing && (matchedFavorites.length > 0 || shownResults.length > 0)

  return (
    <>
      <section>
        <FormSectionLabel hint={locked ? undefined : '(optional)'}>Court</FormSectionLabel>
        <div className={gameFormPanel}>
          {locked ? (
            value.venue || value.locationName ? (
              <PickedCourt
                eyebrow="Your court"
                name={value.venue?.name || value.locationName}
                address={value.venue?.address ?? null}
                venue={value.venue}
              />
            ) : (
              <p className="text-[12.5px] text-[rgba(26,26,26,0.5)]">Loading your court…</p>
            )
          ) : value.venue ? (
            <PickedCourt
              name={value.venue.name}
              address={value.venue.address}
              venue={value.venue}
              onChange={clearVenue}
            />
          ) : custom ? (
            <div className="space-y-3">
              <label className={`${gameFormWell} flex h-12 items-center gap-2.5 px-4 focus-within:ring-2 focus-within:ring-brand-primary/40`}>
                <MapPin size={17} strokeWidth={1.7} className="flex-none text-[rgba(26,26,26,0.45)]" aria-hidden />
                <input
                  type="text"
                  value={value.locationName}
                  onChange={(event) => onChange({ ...value, locationName: event.target.value.slice(0, 200) })}
                  placeholder="Court name or address"
                  aria-label="Court name or address"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none"
                />
              </label>
              <TextButton onClick={() => { setCustom(false); onChange({ ...value, locationName: '' }) }}>
                Pick from the list
              </TextButton>
            </div>
          ) : (
            <div className="space-y-3">
              <label className={`${gameFormWell} flex h-12 items-center gap-2.5 px-4 focus-within:ring-2 focus-within:ring-brand-primary/40`}>
                <Search size={17} strokeWidth={1.7} className="flex-none text-[rgba(26,26,26,0.45)]" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search courts"
                  aria-label="Search courts by name or address"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  name="court-query"
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
              </label>
              {placeReady && anchorReady && !anchor && !coords && !cityName && (
                <FormNote>Add a city to your profile to search courts near you</FormNote>
              )}
              {hasRows && (
                <div className="divide-y divide-[#EAE5DF]">
                  {matchedFavorites.length > 0 && (
                    <p className="pb-1.5 text-[10px] uppercase tracking-[0.2em] text-[rgba(26,26,26,0.45)]">My courts</p>
                  )}
                  {matchedFavorites.map((venue) => (
                    <CourtRow key={venue.id} venue={venue} favorite onPick={() => selectVenue(venue)} />
                  ))}
                  {shownResults.map((venue) => (
                    <CourtRow key={venue.id} venue={venue} onPick={() => selectVenue(venue)} />
                  ))}
                </div>
              )}
              {typing && (!anchorReady || searching) && (
                <p className="text-[12px] text-[rgba(26,26,26,0.45)]">Looking…</p>
              )}
              {typing && anchorReady && !searching && !hasRows && (anchor || coords || cityName) && (
                <p className="text-[12.5px] text-[rgba(26,26,26,0.5)]">No courts match that</p>
              )}
              <TextButton onClick={() => setCustom(true)}>Court isn&apos;t listed</TextButton>
            </div>
          )}
        </div>
      </section>

      <section>
        <FormSectionLabel>Court cost</FormSectionLabel>
        <div className={`${gameFormPanel} space-y-3`}>
          {lockedFree ? (
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 flex-none place-items-center rounded-[14px] bg-brand-primary-muted text-brand-primary" aria-hidden>
                <Check size={18} strokeWidth={2} />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-[#1a1a1a]">Free court</p>
                <p className="text-[12px] text-[rgba(26,26,26,0.5)]">Nothing to pay</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Choice active={value.courtCostCents === 0} onClick={chooseFree}>Free</Choice>
                <Choice active={pricing} onClick={() => {
                  setPricing(true)
                  if (!dollars) {
                    onChange({ ...value, courtCostCents: null, costCurrency: value.costCurrency ?? 'USD', payment: null })
                  }
                }}>Set a price</Choice>
              </div>

              {pricing && (
                <>
                  <div className={`${gameFormWell} flex h-14 items-center gap-2 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-brand-primary/40`}>
                    <span className="font-numbers text-[22px] leading-none text-[rgba(26,26,26,0.45)]" aria-hidden>
                      {currencySymbol(value.costCurrency ?? 'USD')}
                    </span>
                    <input
                      inputMode="decimal"
                      value={dollars}
                      onChange={(event) => chooseAmount(event.target.value.replace(/[^0-9.]/g, '').slice(0, 7))}
                      placeholder="24"
                      aria-label="Court cost amount"
                      className="min-w-0 flex-1 bg-transparent font-numbers text-[22px] leading-none text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none"
                    />
                    <div className="flex flex-none gap-1 rounded-full bg-white/70 p-1" role="group" aria-label="Currency">
                      {CURRENCY_OPTIONS.map((option) => {
                        const active = (value.costCurrency ?? 'USD') === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => chooseCurrency(option.value)}
                            className={`grid h-9 w-9 place-items-center rounded-full text-[14px] font-semibold transition-colors ${
                              active ? 'bg-[#E8748A] text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]'
                            }`}
                            aria-pressed={active}
                            aria-label={option.label}
                          >
                            {option.symbol}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <FormNote>Whole court, whole session. Not per hour or per player.</FormNote>
                </>
              )}

              {priced && (
                <div className="space-y-2.5 border-t border-[#EAE5DF] pt-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-[rgba(26,26,26,0.5)]">Who pays</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_OPTIONS.map((option) => (
                      <Choice key={option.value} active={value.payment === option.value} onClick={() => onChange({ ...value, payment: option.value })}>
                        {option.label}
                      </Choice>
                    ))}
                  </div>
                  <FormNote>
                    {PAYMENT_OPTIONS.find((option) => option.value === value.payment)?.hint ?? 'Players settle this outside the app'}
                  </FormNote>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  )
}

function PickedCourt({
  eyebrow,
  name,
  address,
  venue,
  onChange,
}: {
  eyebrow?: string
  name: string
  address: string | null
  venue: CourtPick | null
  onChange?: () => void
}) {
  const facts = venue
    ? [lightsLabel(venue.lit), venue.fee === false ? 'Free' : venue.fee === true ? 'Fee' : null, arrivalLabel(venue)].filter(
        (fact): fact is string => Boolean(fact),
      )
    : []
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-12 w-12 flex-none place-items-center rounded-[16px] bg-brand-primary-muted text-brand-primary" aria-hidden>
        <MapPin size={22} strokeWidth={1.6} />
      </span>
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-[10px] uppercase tracking-[0.2em] text-[rgba(26,26,26,0.5)]">{eyebrow}</p>}
        <p className="font-display text-[22px] uppercase leading-none tracking-wide text-[#1a1a1a]">{name}</p>
        {address && <p className="mt-1 truncate text-[12px] text-[rgba(26,26,26,0.5)]">{address}</p>}
        {facts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {facts.map((fact) => (
              <span key={fact} className="rounded-full bg-brand-surface px-2.5 py-1 text-[11px] font-medium text-[rgba(26,26,26,0.65)]">
                {fact}
              </span>
            ))}
          </div>
        )}
      </div>
      {onChange && (
        <button
          type="button"
          onClick={onChange}
          className="flex-none rounded-full bg-brand-surface px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-[rgba(26,26,26,0.6)] transition-colors hover:bg-brand-field"
        >
          Change
        </button>
      )}
    </div>
  )
}

function CourtRow({ venue, favorite = false, onPick }: { venue: VenueResult; favorite?: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="flex w-full items-center gap-3 py-2.5 text-left transition-opacity hover:opacity-70">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-brand-surface text-[rgba(26,26,26,0.5)]" aria-hidden>
        {favorite ? <Star size={14} strokeWidth={1.8} /> : <MapPin size={14} strokeWidth={1.8} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-[#1a1a1a]">{venue.name}</span>
        {venue.address && <span className="block truncate text-[11.5px] text-[rgba(26,26,26,0.45)]">{venue.address}</span>}
      </span>
    </button>
  )
}

function TextButton({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-medium uppercase tracking-[0.14em] text-[rgba(26,26,26,0.55)] underline decoration-[#1a1a1a]/20 underline-offset-4 hover:text-[#1a1a1a]"
    >
      {children}
    </button>
  )
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-11 rounded-[16px] px-3 text-[14px] font-semibold ${gameFormChoiceClass(active)}`}
    >
      {children}
    </button>
  )
}
