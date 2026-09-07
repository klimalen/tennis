'use client'

import { Search, SlidersHorizontal, MapPin, Zap, DollarSign, Globe, Phone, Navigation, X, Clock, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Venue {
  id: string
  osm_id: string
  name: string
  lat: number
  lng: number
  address: string | null
  surface: string | null
  court_count: number | null
  lit: boolean | null
  access: string | null
  fee: boolean | null
  website: string | null
  phone: string | null
  operator: string | null
  opening_hours: string | null
}

type FilterTab = 'all' | 'players' | 'open_games' | 'courts' | 'coaches'

interface NominatimPlace {
  place_id: number
  display_name: string
  name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string] // [south, north, west, east]
  type?: string
  class?: string
  address?: { country?: string; city?: string; town?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** 2×2 OSM tile grid component — court always centered in the thumbnail */
function MapThumbnail({ lat, lng }: { lat: number; lng: number }) {
  const z = 15
  const tx = Math.floor(((lng + 180) / 360) * Math.pow(2, z))
  const latRad = (lat * Math.PI) / 180
  const ty = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z),
  )
  const fx = ((lng + 180) / 360) * Math.pow(2, z) - tx
  const fy =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z) - ty

  // Pick the 2×2 block so the court falls near the center
  const x0 = fx >= 0.5 ? tx : tx - 1
  const y0 = fy >= 0.5 ? ty : ty - 1
  const courtX = fx >= 0.5 ? fx * 256 : 256 + fx * 256
  const courtY = fy >= 0.5 ? fy * 256 : 256 + fy * 256
  const left = Math.round(40 - courtX)
  const top = Math.round(40 - courtY)

  const tiles = [
    { x: x0, y: y0, dx: 0, dy: 0 },
    { x: x0 + 1, y: y0, dx: 256, dy: 0 },
    { x: x0, y: y0 + 1, dx: 0, dy: 256 },
    { x: x0 + 1, y: y0 + 1, dx: 256, dy: 256 },
  ]

  return (
    <div className="relative overflow-hidden bg-brand-surface flex-shrink-0" style={{ width: 80, height: 80 }}>
      <div className="absolute" style={{ left, top, width: 512, height: 512 }}>
        {tiles.map(({ x, y, dx, dy }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${x}-${y}`}
            src={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`}
            alt=""
            style={{ position: 'absolute', left: dx, top: dy, width: 256, height: 256 }}
          />
        ))}
      </div>
      {/* Court marker */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-primary ring-2 ring-white shadow" />
      </div>
    </div>
  )
}

function boundingBoxClient(lat: number, lng: number, radiusKm: number) {
  const earthKm = 6371
  const deltaLat = (radiusKm / earthKm) * (180 / Math.PI)
  const deltaLng = deltaLat / Math.cos((lat * Math.PI) / 180)
  return { south: lat - deltaLat, north: lat + deltaLat, west: lng - deltaLng, east: lng + deltaLng }
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

// ─── Surface badge ────────────────────────────────────────────────────────────

const SURFACE_STYLES: Record<string, string> = {
  clay: 'bg-[#D4622A] text-white',
  grass: 'bg-brand-fern text-white',
  hard: 'bg-brand-navy text-white',
}

function SurfaceBadge({ surface }: { surface: string | null }) {
  if (!surface) return null
  const label = surface.charAt(0).toUpperCase() + surface.slice(1)
  const cls =
    SURFACE_STYLES[surface.toLowerCase()] ??
    'bg-brand-surface text-[rgba(26,26,26,0.6)]'
  return (
    <span
      className={`px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold ${cls}`}
    >
      {label}
    </span>
  )
}

// ─── Venue detail sheet ───────────────────────────────────────────────────────

function googleMapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lng},17z`
}

function VenueSheet({
  venue,
  userLat,
  userLng,
  onClose,
}: {
  venue: Venue
  userLat: number
  userLng: number
  onClose: () => void
}) {
  const distanceM = haversineMeters(userLat, userLng, venue.lat, venue.lng)
  const delta = 0.008
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${venue.lng - delta},${venue.lat - delta},${venue.lng + delta},${venue.lat + delta}&layer=mapnik&marker=${venue.lat},${venue.lng}`

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white max-h-[85vh] overflow-y-auto md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:shadow-xl">
        {/* Header strip with close button */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-divider">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium">Tennis Court</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]">
            <X size={16} />
          </button>
        </div>
        {/* Interactive map */}
        <div className="h-48 bg-brand-surface">
          <iframe
            src={osmEmbed}
            className="w-full h-full border-0"
            title={`Map of ${venue.name}`}
          />
        </div>

        <div className="p-5 space-y-4">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl leading-none tracking-wide uppercase text-[#1a1a1a]">
                {venue.name}
              </h2>
              <span className="text-[11px] text-[rgba(26,26,26,0.45)] flex items-center gap-1 flex-shrink-0 mt-1">
                <MapPin size={11} />
                {formatDistance(distanceM)}
              </span>
            </div>
            {venue.address && (
              <p className="text-[12px] text-[rgba(26,26,26,0.5)] mt-1">{venue.address}</p>
            )}
          </div>

          {/* Attributes */}
          <div className="flex flex-wrap gap-2">
            <SurfaceBadge surface={venue.surface} />
            {venue.court_count != null && (
              <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
                {venue.court_count} {venue.court_count === 1 ? 'court' : 'courts'}
              </span>
            )}
            {venue.lit && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
                <Zap size={9} /> Floodlit
              </span>
            )}
            {venue.fee === false && (
              <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
                Free
              </span>
            )}
            {venue.fee === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
                <DollarSign size={9} /> Fee
              </span>
            )}
          </div>

          {/* Opening hours */}
          {venue.opening_hours && (
            <div className="flex items-start gap-2 text-[12px] text-[rgba(26,26,26,0.6)]">
              <Clock size={13} className="mt-0.5 flex-shrink-0 text-[rgba(26,26,26,0.35)]" />
              <span>{venue.opening_hours}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="grid grid-cols-1 gap-2 pt-1">
            <a
              href={googleMapsUrl(venue.lat, venue.lng, venue.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
            >
              <Navigation size={13} />
              View on Google Maps
            </a>
            {venue.website && (
              <a
                href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 border border-brand-divider text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.7)] hover:bg-brand-surface transition-colors"
              >
                <Globe size={13} />
                Website
              </a>
            )}
            {venue.phone && (
              <a
                href={`tel:${venue.phone}`}
                className="flex items-center justify-center gap-2 px-4 py-3 border border-brand-divider text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.7)] hover:bg-brand-surface transition-colors"
              >
                <Phone size={13} />
                {venue.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({
  venue,
  userLat,
  userLng,
  viewed,
  onClick,
}: {
  venue: Venue
  userLat: number
  userLng: number
  viewed: boolean
  onClick: () => void
}) {
  const distanceM = haversineMeters(userLat, userLng, venue.lat, venue.lng)

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white border border-brand-divider hover:border-brand-primary/40 transition-colors active:bg-brand-surface ${viewed ? 'opacity-55' : ''}`}
    >
      <div className="flex gap-0">
        <MapThumbnail lat={venue.lat} lng={venue.lng} />
        {/* Info */}
        <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-between">
          <div>
            <p className="font-display text-[18px] leading-none tracking-wide text-[#1a1a1a] uppercase">
              {venue.name}
            </p>
            {venue.address && (
              <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-1 truncate">{venue.address}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className="text-[11px] text-[rgba(26,26,26,0.4)] flex items-center gap-0.5">
              <MapPin size={10} />{formatDistance(distanceM)}
            </span>
            <SurfaceBadge surface={venue.surface} />
            {venue.lit && (
              <span className="inline-flex items-center gap-0.5 text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">
                <Zap size={9} />Lit
              </span>
            )}
            {venue.fee === false && (
              <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">Free</span>
            )}
            {venue.fee === true && (
              <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">Fee</span>
            )}
            {venue.court_count != null && (
              <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">
                {venue.court_count}c
              </span>
            )}
          </div>
        </div>
        {/* Chevron */}
        <div className="flex items-center pr-3 text-[rgba(26,26,26,0.2)]">
          <ChevronRight size={14} />
        </div>
      </div>
    </button>
  )
}

// ─── Player skeleton ──────────────────────────────────────────────────────────

function PlayerCardSkeleton() {
  return (
    <div className="bg-white rounded p-4 flex gap-3 animate-pulse">
      <div className="w-14 h-14 rounded-full bg-brand-surface-md flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-brand-surface-md rounded w-1/3" />
        <div className="h-3 bg-brand-surface rounded w-1/2" />
        <div className="h-3 bg-brand-surface rounded w-2/3" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-16 bg-brand-surface rounded" />
          <div className="h-5 w-20 bg-brand-surface rounded" />
        </div>
      </div>
    </div>
  )
}

// ─── Filter chips config ──────────────────────────────────────────────────────

const FILTER_CHIPS: { label: string; value: FilterTab }[] = [
  { label: 'All', value: 'all' },
  { label: 'Players', value: 'players' },
  { label: 'Open Games', value: 'open_games' },
  { label: 'Courts', value: 'courts' },
  { label: 'Coaches', value: 'coaches' },
]

// ─── Search client ────────────────────────────────────────────────────────────

export function SearchClient({ user }: { user: User | null }) {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cityInput, setCityInput] = useState('')
  const [cityLabel, setCityLabel] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [viewedVenues, setViewedVenues] = useState<Set<string>>(new Set())
  const skipAutocompleteRef = useRef(false)

  // Debounced autocomplete
  useEffect(() => {
    if (skipAutocompleteRef.current) {
      skipAutocompleteRef.current = false
      return
    }
    const q = cityInput.trim()
    if (q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setLoadingSuggestions(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=7&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } },
        )
        const results = (await res.json()) as NominatimPlace[]
        // Prefer place-type results (cities/towns) over streets/buildings
        const places = results.filter((r) =>
          r.class === 'place' || r.class === 'boundary' || r.class === 'landuse'
        )
        setSuggestions((places.length ? places : results).slice(0, 5))
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggestions(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [cityInput])

  async function loadVenuesByBbox(south: number, west: number, north: number, east: number) {
    setLoadingVenues(true)
    setError(null)
    setShowSuggestions(false)
    try {
      const params = new URLSearchParams({
        south: String(south),
        west: String(west),
        north: String(north),
        east: String(east),
      })
      const res = await fetch(`/api/venues?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { venues: Venue[] }
      setVenues(json.venues ?? [])
    } catch (err) {
      console.error('Failed to fetch venues:', err)
      setVenues([])
      setError('Failed to load courts. Please try again.')
    } finally {
      setLoadingVenues(false)
    }
  }

  function selectSuggestion(place: NominatimPlace) {
    skipAutocompleteRef.current = true
    setCityInput(place.name)
    setCityLabel(place.name + (place.address?.country ? `, ${place.address.country}` : ''))
    setSuggestions([])
    setShowSuggestions(false)
    // Nominatim boundingbox: [south, north, west, east]
    const bb = place.boundingbox.map(Number)
    const s = bb[0] ?? 0, n = bb[1] ?? 0, w = bb[2] ?? 0, e = bb[3] ?? 0
    const lat = (s + n) / 2
    const lng = (w + e) / 2
    setUserCoords({ lat, lng })
    void loadVenuesByBbox(s, w, n, e)
  }

  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      return
    }
    setLoadingVenues(true)
    setError(null)
    setShowSuggestions(false)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setUserCoords({ lat: latitude, lng: longitude })
        setCityLabel('your location')
        const { south, west, north, east } = boundingBoxClient(latitude, longitude, 10)
        void loadVenuesByBbox(south, west, north, east)
      },
      () => {
        setLoadingVenues(false)
        // Fail silently — city search is the main flow
      },
      { timeout: 10_000 },
    )
  }

  // No auto-trigger — user explicitly requests location or types a city

  function handleFilterChange(value: FilterTab) {
    if (value !== 'courts') {
      setVenues([])
      setError(null)
      setSuggestions([])
    }
    setFilter(value)
  }

  const showCourts = filter === 'courts'

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {selectedVenue && userCoords && (
        <VenueSheet
          venue={selectedVenue}
          userLat={userCoords.lat}
          userLng={userCoords.lng}
          onClose={() => setSelectedVenue(null)}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 bg-brand-surface rounded px-4 py-2.5">
            <Search size={16} className="text-[rgba(26,26,26,0.4)]" />
            <span className="text-[rgba(26,26,26,0.4)] text-sm">
              Players, games, courts, coaches...
            </span>
          </div>
          <button className="w-9 h-9 rounded bg-brand-surface flex items-center justify-center">
            <SlidersHorizontal size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 py-3 border-b border-brand-divider overflow-x-auto">
        <div className="flex gap-2 max-w-2xl mx-auto">
          {FILTER_CHIPS.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => handleFilterChange(value)}
              className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors ${
                filter === value
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-surface text-[rgba(26,26,26,0.6)] hover:bg-brand-surface-md'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* CTA banner — only for guests */}
        {!user && (
          <div className="bg-brand-primary-muted border border-brand-primary/20 rounded px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-brand-primary font-medium">
              Sign up to connect with players near you
            </p>
            <Link
              href="/sign-up"
              className="flex-shrink-0 px-4 py-1.5 bg-brand-primary text-white text-xs font-semibold rounded hover:bg-brand-primary-dark transition-colors"
            >
              Join free
            </Link>
          </div>
        )}

        {/* Courts view */}
        {showCourts && (
          <>
            {/* City search with autocomplete */}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => { setCityInput(e.target.value); setShowSuggestions(true) }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  placeholder="Search city or area..."
                  className="flex-1 bg-brand-surface border border-brand-divider px-4 py-2.5 text-sm outline-none focus:border-brand-primary placeholder:text-[rgba(26,26,26,0.35)]"
                />
                {loadingSuggestions && (
                  <div className="absolute right-16 top-1/2 -translate-y-1/2">
                    <div className="w-3.5 h-3.5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>

              {/* Suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-brand-divider shadow-sm mt-0.5">
                  {suggestions.map((place) => {
                    const country = place.address?.country
                    const subtitle = [place.address?.city ?? place.address?.town, country]
                      .filter(Boolean)
                      .join(', ')
                    return (
                      <button
                        key={place.place_id}
                        onMouseDown={() => selectSuggestion(place)}
                        className="w-full text-left px-4 py-2.5 hover:bg-brand-surface transition-colors border-b border-brand-divider last:border-0"
                      >
                        <p className="text-sm text-[#1a1a1a]">{place.name}</p>
                        {subtitle && subtitle !== place.name && (
                          <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">{subtitle}</p>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <button
              onClick={requestGeolocation}
              disabled={loadingVenues}
              className="flex items-center gap-1.5 text-[11px] text-brand-primary tracking-[0.1em] uppercase font-medium hover:underline disabled:opacity-40 -mt-1"
            >
              <MapPin size={11} />
              Use my location
            </button>

            {error && (
              <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{error}</p>
            )}

            {loadingVenues && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-5 h-5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
                <p className="text-[11px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                  Finding courts{cityLabel ? ` near ${cityLabel}` : ''}...
                </p>
              </div>
            )}

            {!loadingVenues && userCoords && venues.length === 0 && !error && (
              <div className="border border-brand-divider bg-brand-surface px-4 py-6 text-center">
                <p className="text-sm text-[rgba(26,26,26,0.6)]">No courts found in this area</p>
              </div>
            )}

            {!loadingVenues && userCoords && venues.length > 0 && (
              <>
                {cityLabel && (
                  <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                    {venues.length} {venues.length === 1 ? 'court' : 'courts'} near {cityLabel}
                  </p>
                )}
                {venues.map((venue) => (
                  <VenueCard
                    key={venue.id}
                    venue={venue}
                    userLat={userCoords.lat}
                    userLng={userCoords.lng}
                    viewed={viewedVenues.has(venue.id)}
                    onClick={() => {
                      setSelectedVenue(venue)
                      setViewedVenues(prev => new Set(prev).add(venue.id))
                    }}
                  />
                ))}
              </>
            )}
          </>
        )}

        {/* Players / default view — skeleton cards */}
        {!showCourts && (
          <>
            {[...Array(6)].map((_, i) => (
              <PlayerCardSkeleton key={i} />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
