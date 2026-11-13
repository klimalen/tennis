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
import { FormSectionLabel } from '@/components/games/WhenFields'
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

  return (
    <div className="space-y-3">
      <FormSectionLabel>
        Court
        {!locked && (
          <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]"> (optional)</span>
        )}
      </FormSectionLabel>

      {locked ? (
        value.venue || value.locationName ? (
          <div className="rounded-[20px] border border-[#1a1a1a]/15 bg-brand-field px-3 py-3">
            <div className="min-w-0">
              <p className="font-display text-xl leading-none tracking-wide uppercase text-[#1a1a1a]">
                {value.venue?.name || value.locationName}
              </p>
              {value.venue?.address && (
                <p className="mt-1 text-[12px] text-[rgba(26,26,26,0.5)]">{value.venue.address}</p>
              )}
            </div>
            {value.venue && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lightsLabel(value.venue.lit) && <Fact>{lightsLabel(value.venue.lit)}</Fact>}
                {value.venue.fee === false && <Fact>Free</Fact>}
                {value.venue.fee === true && <Fact>Fee</Fact>}
                {arrivalLabel(value.venue) && <Fact>{arrivalLabel(value.venue)}</Fact>}
              </div>
            )}
            <p className="mt-2 text-[11px] text-[rgba(26,26,26,0.45)]">Your court — fixed for games you organise.</p>
          </div>
        ) : (
          <p className="text-[12px] text-[rgba(26,26,26,0.5)]">Loading your court…</p>
        )
      ) : value.venue ? (
        <div className="rounded-[20px] border border-[#1a1a1a]/15 bg-brand-field px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-xl leading-none tracking-wide uppercase text-[#1a1a1a]">{value.venue.name}</p>
              {value.venue.address && <p className="mt-1 text-[12px] text-[rgba(26,26,26,0.5)]">{value.venue.address}</p>}
            </div>
            <button type="button" onClick={clearVenue} className="text-[10px] tracking-[0.14em] uppercase text-[rgba(26,26,26,0.45)]">
              Change
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lightsLabel(value.venue.lit) && <Fact>{lightsLabel(value.venue.lit)}</Fact>}
            {value.venue.fee === false && <Fact>Free</Fact>}
            {value.venue.fee === true && <Fact>Fee</Fact>}
            {arrivalLabel(value.venue) && <Fact>{arrivalLabel(value.venue)}</Fact>}
          </div>
        </div>
      ) : custom ? (
        <div>
          <input
            type="text"
            value={value.locationName}
            onChange={(event) => onChange({ ...value, locationName: event.target.value.slice(0, 200) })}
            placeholder="Court name or address"
            className="w-full px-3 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary"
          />
          <button type="button" onClick={() => { setCustom(false); onChange({ ...value, locationName: '' }) }} className="mt-2 text-[10px] tracking-[0.14em] uppercase text-[rgba(26,26,26,0.45)]">
            Pick from the list
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Court name or address"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            name="court-query"
            className="w-full px-3 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary"
          />
          {placeReady && anchorReady && !anchor && !coords && !cityName && (
            <p className="text-[12px] text-[rgba(26,26,26,0.5)]">Add a city to your profile to search courts near you.</p>
          )}
          {typing && matchedFavorites.length > 0 && (
            <div className="space-y-1">
              <p className="text-[9px] tracking-[0.16em] uppercase text-[rgba(26,26,26,0.35)]">My courts</p>
              {matchedFavorites.map((venue) => (
                <CourtRow key={venue.id} venue={venue} onPick={() => selectVenue(venue)} />
              ))}
            </div>
          )}
          {typing && (!anchorReady || searching) && <p className="text-[11px] text-[rgba(26,26,26,0.4)]">Looking…</p>}
          {typing && listed.slice(0, 8).map((venue) => (
            <CourtRow key={venue.id} venue={venue} onPick={() => selectVenue(venue)} />
          ))}
          {typing && anchorReady && !searching && matchedFavorites.length === 0 && listed.length === 0 && (anchor || coords || cityName) && (
            <p className="text-[12px] text-[rgba(26,26,26,0.5)]">No courts match that.</p>
          )}
          <button type="button" onClick={() => setCustom(true)} className="text-[10px] tracking-[0.14em] uppercase text-[#1a1a1a] underline underline-offset-4">
            Court isn&apos;t listed
          </button>
        </div>
      )}

      <div className="space-y-2">
        <FormSectionLabel>Court cost</FormSectionLabel>
        {lockedFree ? (
          <p className="text-[12px] text-[rgba(26,26,26,0.55)]">This court is free. Nothing to pay.</p>
        ) : (
          <>
            <p className="text-[12px] text-[rgba(26,26,26,0.55)]">
              Total for the whole court, for this whole session. Not per hour, and not per player.
            </p>
            <div className="flex gap-2">
                <Pill active={value.courtCostCents === 0} onClick={chooseFree}>Free</Pill>
                <Pill active={pricing} onClick={() => {
                  setPricing(true)
                  if (!dollars) {
                    onChange({ ...value, courtCostCents: null, costCurrency: value.costCurrency ?? 'USD', payment: null })
                  }
                }}>Set a price</Pill>
              </div>
              {pricing && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    inputMode="decimal"
                    value={dollars}
                    onChange={(event) => chooseAmount(event.target.value.replace(/[^0-9.]/g, '').slice(0, 7))}
                    placeholder="24"
                    aria-label="Court cost amount"
                    className="h-11 w-28 rounded-full border border-[#1a1a1a]/40 bg-brand-field px-3 text-sm leading-none text-[#1a1a1a] focus:outline-none focus:border-brand-primary"
                  />
                  <div className="flex gap-1.5" role="group" aria-label="Currency">
                    {CURRENCY_OPTIONS.map((option) => {
                      const active = (value.costCurrency ?? 'USD') === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => chooseCurrency(option.value)}
                          className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-medium leading-none transition-colors ${
                            active
                              ? 'border-[#E8748A] bg-[#E8748A] text-[#1a1a1a]'
                              : 'border-[#1a1a1a]/40 bg-brand-field text-[rgba(26,26,26,0.55)] hover:border-[#1a1a1a]/60'
                          }`}
                          aria-pressed={active}
                          aria-label={option.label}
                        >
                          {option.symbol}
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-[11px] text-[rgba(26,26,26,0.4)]">
                    {currencySymbol(value.costCurrency ?? 'USD')} total for the session
                  </span>
                </div>
              )}
              {priced && (
                <div className="space-y-2">
                  <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">How players pay</p>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_OPTIONS.map((option) => (
                      <Pill key={option.value} active={value.payment === option.value} onClick={() => onChange({ ...value, payment: option.value })}>
                        {option.label}
                      </Pill>
                    ))}
                  </div>
                  <p className="text-[11px] text-[rgba(26,26,26,0.45)]">
                    {PAYMENT_OPTIONS.find((option) => option.value === value.payment)?.hint ?? 'Players settle this outside the app.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
    </div>
  )
}

function CourtRow({ venue, onPick }: { venue: VenueResult; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} className="w-full text-left rounded-[16px] border border-[#1a1a1a]/10 bg-white px-3 py-2 hover:border-[#1a1a1a]/30">
      <p className="text-sm text-[#1a1a1a]">{venue.name}</p>
      {venue.address && <p className="text-[11px] text-[rgba(26,26,26,0.45)] truncate">{venue.address}</p>}
    </button>
  )
}

function Fact({ children }: { children: string | null }) {
  if (!children) return null
  return <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">{children}</span>
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-11 min-h-11 max-h-11 items-center justify-center rounded-full border px-4 text-sm font-medium leading-none tracking-[0.08em] transition-colors ${
        active ? 'border-[#E8748A] bg-[#E8748A] text-[#1a1a1a]' : 'border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a]'
      }`}
    >
      {children}
    </button>
  )
}
