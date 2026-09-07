'use client'

import { Search, SlidersHorizontal, MapPin, Zap, DollarSign } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect } from 'react'
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({
  venue,
  userLat,
  userLng,
}: {
  venue: Venue
  userLat: number
  userLng: number
}) {
  const distanceM = haversineMeters(userLat, userLng, venue.lat, venue.lng)

  return (
    <div className="bg-white border border-brand-divider p-4 space-y-3">
      {/* Top row: surface badge + distance */}
      <div className="flex items-center justify-between gap-2">
        <SurfaceBadge surface={venue.surface} />
        <span className="text-[11px] text-[rgba(26,26,26,0.45)] flex items-center gap-1 flex-shrink-0">
          <MapPin size={11} />
          {formatDistance(distanceM)}
        </span>
      </div>

      {/* Name */}
      <div>
        <p className="font-display text-[20px] leading-none tracking-wide text-[#1a1a1a] uppercase">
          {venue.name}
        </p>
        {(venue.address ?? venue.operator) && (
          <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-1 truncate">
            {venue.address ?? venue.operator}
          </p>
        )}
      </div>

      {/* Attribute badges */}
      <div className="flex flex-wrap gap-1.5">
        {venue.lit && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
            <Zap size={9} />
            Floodlit
          </span>
        )}
        {venue.access && (
          <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
            {venue.access}
          </span>
        )}
        {venue.fee === true && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
            <DollarSign size={9} />
            Fee
          </span>
        )}
        {venue.fee === false && (
          <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
            Free
          </span>
        )}
        {venue.court_count != null && (
          <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
            {venue.court_count} {venue.court_count === 1 ? 'court' : 'courts'}
          </span>
        )}
      </div>
    </div>
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
  const [locationError, setLocationError] = useState(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)

  function fetchCourts() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError(true)
      return
    }

    setLoadingVenues(true)
    setLocationError(false)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        setUserCoords({ lat: latitude, lng: longitude })
        try {
          const res = await fetch(
            `/api/venues?lat=${latitude}&lng=${longitude}&radius=10`,
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = (await res.json()) as { venues: Venue[] }
          setVenues(json.venues ?? [])
        } catch (err) {
          console.error('Failed to fetch venues:', err)
          setVenues([])
        } finally {
          setLoadingVenues(false)
        }
      },
      () => {
        setLocationError(true)
        setLoadingVenues(false)
      },
      { timeout: 10_000 },
    )
  }

  useEffect(() => {
    if (filter !== 'courts') return
    fetchCourts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  function handleFilterChange(value: FilterTab) {
    if (value !== 'courts') {
      setVenues([])
      setLocationError(false)
    }
    setFilter(value)
  }

  const showCourts = filter === 'courts'

  return (
    <div className="min-h-screen pb-20 md:pb-0">
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
            {loadingVenues && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-5 h-5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
                <p className="text-[11px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                  Finding courts near you...
                </p>
              </div>
            )}

            {!loadingVenues && locationError && (
              <div className="border border-brand-divider bg-brand-surface px-4 py-8 text-center space-y-3">
                <MapPin size={20} className="mx-auto text-[rgba(26,26,26,0.3)]" />
                <p className="text-sm text-[rgba(26,26,26,0.6)]">
                  Location access is needed to find nearby courts
                </p>
                <button
                  onClick={fetchCourts}
                  className="px-5 py-2 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
                >
                  Enable location
                </button>
              </div>
            )}

            {!loadingVenues && !locationError && userCoords && venues.length === 0 && (
              <div className="border border-brand-divider bg-brand-surface px-4 py-6 text-center">
                <p className="text-sm text-[rgba(26,26,26,0.6)]">
                  No courts found within 10 km
                </p>
              </div>
            )}

            {!loadingVenues &&
              !locationError &&
              userCoords &&
              venues.length > 0 &&
              venues.map((venue) => (
                <VenueCard
                  key={venue.id}
                  venue={venue}
                  userLat={userCoords.lat}
                  userLng={userCoords.lng}
                />
              ))}
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
