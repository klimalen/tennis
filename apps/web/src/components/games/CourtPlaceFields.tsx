'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { arrivalLabel, dollarsToCents, lightsLabel, PAYMENT_OPTIONS, type CourtPayment } from '@/lib/game-court'
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

// "Austin" can be saved as a different city than the one with courts.
// When the saved point has no matches, try the city name.
async function findCourts(
  q: string,
  coords: { lat: number; lng: number } | null,
  cityName: string | null,
): Promise<VenueResult[]> {
  if (coords) {
    const near = await fetchCourts(coords.lat, coords.lng, q)
    if (near.length > 0) return near
  }
  if (!cityName) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&limit=5`,
    { headers: { 'Accept-Language': 'en' } },
  )
  if (!res.ok) return []
  const places = await res.json() as { lat: string; lon: string }[]
  for (const place of places) {
    const lat = Number(place.lat)
    const lng = Number(place.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    if (coords && haversineKm(coords.lat, coords.lng, lat, lng) < 20) continue
    const venues = await fetchCourts(lat, lng, q)
    if (venues.length > 0) return venues
  }
  return []
}

export function CourtPlaceFields({
  value,
  onChange,
}: {
  value: CourtPlaceValue
  onChange: (next: CourtPlaceValue) => void
}) {
  const [favorites, setFavorites] = useState<VenueResult[]>([])
  const [results, setResults] = useState<VenueResult[]>([])
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState(value.venueId == null && value.locationName.length > 0)
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cityName, setCityName] = useState<string | null>(null)
  const [placeReady, setPlaceReady] = useState(false)
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
    if (custom || value.venue) return
    const q = query.trim()
    if (!q) {
      setResults([])
      setSearching(false)
      return
    }
    if (!placeReady) return
    let cancelled = false
    const handle = setTimeout(() => {
      void (async () => {
        setSearching(true)
        const found = await findCourts(q, coords, cityName)
        if (cancelled) return
        setResults(found)
        setSearching(false)
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [coords, cityName, placeReady, query, custom, value.venue])

  function selectVenue(venue: VenueResult) {
    const free = venue.fee === false
    onChange({
      venueId: venue.id,
      venue,
      locationName: '',
      courtCostCents: free ? 0 : value.courtCostCents,
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
      payment: value.payment,
    })
    setCustom(false)
  }

  function chooseFree() {
    setPricing(false)
    onChange({ ...value, courtCostCents: 0, payment: null })
    setDollars('')
  }

  function chooseAmount(nextDollars: string) {
    setDollars(nextDollars)
    const cents = dollarsToCents(nextDollars)
    onChange({
      ...value,
      courtCostCents: cents && cents > 0 ? cents : null,
      payment: cents && cents > 0 ? value.payment : null,
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
      <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">
        Court <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]">(optional)</span>
      </p>

      {value.venue ? (
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
          {!placeReady ? null : !coords && !cityName && (
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
          {typing && searching && <p className="text-[11px] text-[rgba(26,26,26,0.4)]">Looking…</p>}
          {typing && listed.slice(0, 8).map((venue) => (
            <CourtRow key={venue.id} venue={venue} onPick={() => selectVenue(venue)} />
          ))}
          {typing && !searching && placeReady && matchedFavorites.length === 0 && listed.length === 0 && (coords || cityName) && (
            <p className="text-[12px] text-[rgba(26,26,26,0.5)]">No courts match that.</p>
          )}
          <button type="button" onClick={() => setCustom(true)} className="text-[10px] tracking-[0.14em] uppercase text-[#1a1a1a] underline underline-offset-4">
            Court isn&apos;t listed
          </button>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">Court cost</p>
        {lockedFree ? (
          <p className="text-[12px] text-[rgba(26,26,26,0.55)]">This court is free. Nothing to pay.</p>
        ) : (
          <>
            <p className="text-[12px] text-[rgba(26,26,26,0.55)]">
              Total for the whole court, for this whole session. Not per hour, and not per player.
            </p>
            <div className="flex gap-2">
                <Pill active={value.courtCostCents === 0} onClick={chooseFree}>Free</Pill>
                <Pill active={pricing} onClick={() => { setPricing(true); if (!dollars) onChange({ ...value, courtCostCents: null, payment: null }) }}>Set a price</Pill>
              </div>
              {pricing && (
                <label className="flex items-center gap-2">
                  <input
                    inputMode="decimal"
                    value={dollars}
                    onChange={(event) => chooseAmount(event.target.value.replace(/[^0-9.]/g, '').slice(0, 7))}
                    placeholder="24"
                    className="w-28 px-3 py-2 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm text-[#1a1a1a] focus:outline-none focus:border-brand-primary"
                  />
                  <span className="text-sm text-[rgba(26,26,26,0.45)]">$</span>
                </label>
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
      className={`px-3 py-2 text-[10px] tracking-[0.14em] uppercase font-medium border transition-colors ${
        active ? 'rounded-full border-[#E8748A] bg-[#E8748A] text-[#1a1a1a]' : 'rounded-full bg-brand-field border-[#1a1a1a]/40 text-[#1a1a1a]'
      }`}
    >
      {children}
    </button>
  )
}
