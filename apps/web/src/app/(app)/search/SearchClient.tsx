'use client'

import { MapPin, Zap, DollarSign, Globe, Phone, Navigation, X, Clock, ChevronRight, ChevronLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'
import { skillLabel } from '@/lib/skill'
import { PlayRequestSentButton } from '@/components/ui/PlayRequestSentButton'
import { AvailabilityButton } from '@/components/ui/AvailabilityButton'
import { LookingFor } from '@/components/ui/LookingFor'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncomingRequest {
  id: string
  sender_id: string
  created_at: string
  sender: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
    city_name: string | null
  }
}

export interface Player {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
  preferred_formats: string[]
  play_style: string | null
  total_matches: number
  last_active_at: string | null
  city_name: string | null
  city_lat: number | null
  city_lng: number | null
  bio: string | null
  looking_for: string | null
  availability: unknown
}

export interface Venue {
  id: string
  osm_id: string | null
  name: string
  kind: string
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
  description: string | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  google_maps_uri: string | null
  member_count: number
  confidence: 'low' | 'medium' | 'high'
}

const VENUE_KIND_LABELS: Record<string, string> = {
  public_park: 'Public park',
  tennis_center: 'Tennis center',
  club: 'Club',
  school: 'School',
  residential: 'Private community',
  hotel: 'Hotel / resort',
  commercial: 'Commercial',
  other: 'Facility',
  unknown: 'Tennis courts',
}

function venueKindLabel(kind: string): string {
  return VENUE_KIND_LABELS[kind] ?? 'Tennis courts'
}

function isPrivateVenue(venue: Venue): boolean {
  return venue.access === 'private' || venue.access === 'members' || venue.kind === 'residential'
}

type View = 'discovery' | 'players' | 'games' | 'courts'

interface NominatimPlace {
  place_id: number
  display_name: string
  name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string]
  type?: string
  class?: string
  address?: { country?: string; city?: string; town?: string }
}

interface OpenGameProfile {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
}

interface OpenGameParticipant {
  player_id: string
  status: string
  profile: OpenGameProfile
}

interface OpenGame {
  id: string
  scheduled_at: string
  format: string
  neighborhood: string | null
  notes: string | null
  creator_id: string
  max_players: number
  creator: OpenGameProfile & { city_name: string | null }
  participants: OpenGameParticipant[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
}

function isGenericCourtName(name: string): boolean {
  return /^tennis courts?$/i.test(name.trim())
}

function courtTitle(venue: Venue): string {
  if (isGenericCourtName(venue.name) && venue.address) return venue.address
  return venue.name
}

function surfaceLabel(surface: string): string {
  return surface.replace(/_/g, ' ')
}

type RequestStatus = 'none' | 'pending' | 'accepted' | 'matched' | 'declined'

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
  const label = surfaceLabel(surface)
  const cls = SURFACE_STYLES[surface.toLowerCase()] ?? 'bg-brand-surface text-[rgba(26,26,26,0.6)]'
  return (
    <span className={`px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ─── Player card ──────────────────────────────────────────────────────────────

function skillFill(level: number): string {
  const label = skillLabel(level)
  if (label === 'Beginner') return 'bg-[#E8E1D7] text-[#1a1a1a]'
  if (label === 'Advanced') return 'bg-[#E8748A] text-[#1a1a1a]'
  if (label === 'Competitive') return 'bg-[#D4A017] text-[#1E3A6E]'
  return 'bg-[#3A8A7A] text-[#F0EBE3]'
}

function PlayerCard({
  player,
  status,
  onRequest,
  onCancel,
  onPlan,
  vivid = true,
}: {
  player: Player
  status: RequestStatus
  onRequest: (id: string) => void
  onCancel: (id: string) => void
  onPlan: (player: Player) => void
  vivid?: boolean
}) {
  const skill = player.skill_level_computed ?? player.skill_level_self
  const initials = player.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  const matched = status === 'accepted' || status === 'matched'
  const pending = status === 'pending'

  function handleRequest(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (matched) onPlan(player)
    else if (!pending) onRequest(player.id)
  }

  const btnLabel = matched ? 'Plan a game' : status === 'declined' ? 'Try again' : 'Play together'

  const actionClass = vivid
    ? `w-full rounded-full py-3.5 text-[11px] tracking-[0.18em] uppercase font-medium ${matched ? 'bg-[#3A8A7A] text-[#F0EBE3]' : 'bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'}`
    : 'w-full py-2.5 text-[10px] tracking-[0.2em] uppercase font-medium transition-colors border-t border-brand-divider rounded-full bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'
  const chipClass = vivid
    ? 'px-2.5 py-0.5 rounded-full border border-[#1a1a1a]/10 text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]'
    : 'px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.5)]'

  return (
    <Link href={`/profile/${player.username}`} className={vivid ? 'block rounded-[28px] bg-white active:bg-[#F4F1EC]' : 'block bg-white border border-brand-divider hover:border-brand-primary/40 transition-colors active:bg-brand-surface'}>
      <div className="p-4 flex gap-3">
        <div className={`w-14 h-14 flex-shrink-0 flex items-center justify-center overflow-hidden ${vivid ? 'rounded-full bg-[#E8748A]' : 'bg-brand-surface-md'}`}>
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={player.avatar_url} alt={player.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className={`font-display text-lg ${vivid ? 'text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.4)]'}`}>{initials}</span>
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <div>
            <p className={vivid ? 'font-display text-3xl tracking-wide leading-none text-[#1a1a1a]' : 'font-medium text-[14px] text-[#1a1a1a] leading-tight'}>{vivid ? player.full_name.toUpperCase() : player.full_name}</p>
            <p className={vivid ? 'font-fraunces italic text-sm text-[#85648F] mt-0.5' : 'text-[11px] text-[rgba(26,26,26,0.4)]'}>@{player.username}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {skill != null && (
              <span className={vivid ? `px-2.5 py-0.5 rounded-full text-[9px] tracking-[0.12em] uppercase font-semibold ${skillFill(skill)}` : 'px-2 py-0.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[9px] tracking-[0.12em] uppercase font-semibold'}>
                {skillLabel(skill)}
              </span>
            )}
            {player.preferred_formats.map((f) => (
              <span key={f} className={chipClass}>
                {FORMAT_LABELS[f] ?? f}
              </span>
            ))}
            {player.play_style === 'both' ? (
              <>
                <span className={chipClass}>Recreational</span>
                <span className={chipClass}>Competitive</span>
              </>
            ) : player.play_style ? (
              <span className={chipClass}>
                {player.play_style === 'recreational' ? 'Recreational' : 'Competitive'}
              </span>
            ) : null}
            <AvailabilityButton value={player.availability} />
          </div>
          {player.bio && (
            <p className={vivid ? 'font-fraunces italic text-sm text-[#497250] line-clamp-2 leading-snug' : 'text-[11px] text-[rgba(26,26,26,0.5)] line-clamp-2 leading-relaxed'}>
              {player.bio}
            </p>
          )}
          <LookingFor text={player.looking_for} dense={!vivid} />
          {player.total_matches > 0 && (
            <p className="text-[11px] text-[rgba(26,26,26,0.4)]">{player.total_matches} matches</p>
          )}
        </div>
      </div>
      {pending ? (
        <div className="px-4 pb-4">
          <PlayRequestSentButton onCancel={() => onCancel(player.id)} />
        </div>
      ) : vivid ? (
        <div className="px-4 pb-4">
          <button onClick={handleRequest} className={actionClass}>
            {btnLabel}
          </button>
        </div>
      ) : (
        <button
          onClick={handleRequest}
          className={actionClass}
        >
          {btnLabel}
        </button>
      )}
    </Link>
  )
}

// ─── Map thumbnail ─────────────────────────────────────────────────────────────

function MapThumbnail({ lat, lng }: { lat: number; lng: number }) {
  const z = 15
  const tx = Math.floor(((lng + 180) / 360) * Math.pow(2, z))
  const latRad = (lat * Math.PI) / 180
  const ty = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z),
  )
  const fx = ((lng + 180) / 360) * Math.pow(2, z) - tx
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, z) - ty
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
    <div className="relative m-3 overflow-hidden rounded-[20px] bg-brand-surface flex-shrink-0" style={{ width: 72, height: 72 }}>
      <div className="absolute" style={{ left, top, width: 512, height: 512 }}>
        {tiles.map(({ x, y, dx, dy }) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${x}-${y}`} src={`https://tile.openstreetmap.org/${z}/${x}/${y}.png`} alt="" style={{ position: 'absolute', left: dx, top: dy, width: 256, height: 256 }} />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-2.5 h-2.5 rounded-full bg-brand-primary ring-2 ring-white shadow" />
      </div>
    </div>
  )
}

// ─── Venue sheet ──────────────────────────────────────────────────────────────

function googleMapsUrl(lat: number, lng: number, name: string): string {
  return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lng},17z`
}

function VenueSheet({ venue, userLat, userLng, onClose }: { venue: Venue; userLat: number; userLng: number; onClose: () => void }) {
  const distanceM = haversineMeters(userLat, userLng, venue.lat, venue.lng)
  const delta = 0.008
  const osmEmbed = `https://www.openstreetmap.org/export/embed.html?bbox=${venue.lng - delta},${venue.lat - delta},${venue.lng + delta},${venue.lat + delta}&layer=mapnik&marker=${venue.lat},${venue.lng}`
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-[28px] max-h-[85vh] overflow-y-auto md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:rounded-[28px] md:shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-divider">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium">{venueKindLabel(venue.kind)}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]"><X size={16} /></button>
        </div>
        <div className="h-48 bg-brand-surface">
          <iframe src={osmEmbed} className="w-full h-full border-0" title={`Map of ${venue.name}`} />
        </div>
        <div className="p-5 pb-24 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl leading-none tracking-wide uppercase text-[#1a1a1a]">{courtTitle(venue)}</h2>
              <span className="text-[11px] text-[rgba(26,26,26,0.45)] flex items-center gap-1 flex-shrink-0 mt-1">
                <MapPin size={11} />{formatDistance(distanceM)}
              </span>
            </div>
            {venue.address && courtTitle(venue) !== venue.address && (
              <p className="text-[12px] text-[rgba(26,26,26,0.5)] mt-1">{venue.address}</p>
            )}
          </div>
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
            {venue.has_indoor && <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">Indoor</span>}
            {venue.has_outdoor && venue.has_indoor && <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">Outdoor</span>}
            {venue.fee === false && <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">Free</span>}
            {venue.fee === true && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
                <DollarSign size={9} /> Fee
              </span>
            )}
            {isPrivateVenue(venue) && (
              <span className="px-2 py-0.5 bg-brand-surface-md text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">
                {venue.access === 'members' ? 'Members only' : 'Private'}
              </span>
            )}
          </div>
          {venue.description && (
            <p className="text-[12px] leading-relaxed text-[rgba(26,26,26,0.65)]">{venue.description}</p>
          )}
          {venue.opening_hours && (
            <div className="flex items-start gap-2 text-[12px] text-[rgba(26,26,26,0.6)]">
              <Clock size={13} className="mt-0.5 flex-shrink-0 text-[rgba(26,26,26,0.35)]" />
              <span>{venue.opening_hours}</span>
            </div>
          )}
          <p className="text-[12px] text-[rgba(26,26,26,0.5)]">
            Booking isn&apos;t available in the app yet. Open the court in Google Maps to get there.
          </p>
          <div className="grid grid-cols-1 gap-2 pt-1">
            <a href={venue.google_maps_uri ?? googleMapsUrl(venue.lat, venue.lng, venue.name)} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors">
              <Navigation size={13} /> View on Google Maps
            </a>
            {venue.website && (
              <a href={venue.website.startsWith('http') ? venue.website : `https://${venue.website}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors">
                <Globe size={13} /> Website
              </a>
            )}
            {venue.phone && (
              <a href={`tel:${venue.phone}`}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors">
                <Phone size={13} /> {venue.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Venue card ───────────────────────────────────────────────────────────────

function VenueCard({ venue, userLat, userLng, viewed, onClick, vivid = true }: { venue: Venue; userLat: number; userLng: number; viewed: boolean; onClick: () => void; vivid?: boolean }) {
  const distanceM = haversineMeters(userLat, userLng, venue.lat, venue.lng)
  return (
    <button onClick={onClick} className={`w-full text-left transition-colors ${vivid ? 'overflow-hidden rounded-[28px] bg-white active:bg-[#F4F1EC]' : 'bg-white border border-brand-divider hover:border-brand-primary/40 active:bg-brand-surface'} ${viewed ? 'opacity-55' : ''}`}>
      <div className="flex gap-0">
        <MapThumbnail lat={venue.lat} lng={venue.lng} />
        <div className="flex-1 min-w-0 px-3 py-2.5 flex flex-col justify-between">
          <div>
            <p className={`font-display leading-none tracking-wide text-[#1a1a1a] uppercase ${vivid ? 'text-2xl' : 'text-[18px]'}`}>{courtTitle(venue)}</p>
            <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-1 truncate">
              <span className="text-[9px] tracking-[0.1em] uppercase mr-1.5">{venueKindLabel(venue.kind)}</span>
              {courtTitle(venue) === venue.address ? null : venue.address}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mt-2">
            <span className={`text-[11px] flex items-center gap-0.5 ${vivid ? 'text-[#D4A017]' : 'text-[rgba(26,26,26,0.4)]'}`}><MapPin size={10} />{formatDistance(distanceM)}</span>
            <SurfaceBadge surface={venue.surface} />
            {venue.lit && <span className="inline-flex items-center gap-0.5 text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]"><Zap size={9} />Lit</span>}
            {venue.has_indoor && <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">Indoor</span>}
            {venue.fee === false && <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">Free</span>}
            {venue.fee === true && <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">Fee</span>}
            {isPrivateVenue(venue) && <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">Private</span>}
            {venue.court_count != null && <span className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.45)]">{venue.court_count} {venue.court_count === 1 ? 'court' : 'courts'}</span>}
            {(venue.phone || venue.website) && (
              <span className="inline-flex items-center gap-1 text-[rgba(26,26,26,0.35)]">
                {venue.phone && <Phone size={9} />}
                {venue.website && <Globe size={9} />}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center pr-3 text-[rgba(26,26,26,0.2)]"><ChevronRight size={14} /></div>
      </div>
    </button>
  )
}

// ─── Incoming request card ────────────────────────────────────────────────────

function IncomingRequestCard({ req, onAccept, onDecline }: { req: IncomingRequest; onAccept: (id: string, senderId: string) => Promise<void>; onDecline: (id: string) => Promise<void> }) {
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const { sender } = req
  const skill = sender.skill_level_computed ?? sender.skill_level_self
  const initials = sender.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  return (
    <div className="rounded-[28px] bg-[#E8748A] text-[#1a1a1a] px-5 py-5">
      <p className="text-[10px] tracking-[0.22em] uppercase text-[#1a1a1a]/70 mb-2">✦ Wants to play</p>
      <div className="flex items-center gap-3">
        <Link href={`/profile/${sender.username}`} className="w-14 h-14 rounded-full bg-[#F0EBE3] overflow-hidden flex items-center justify-center flex-shrink-0">
          {sender.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sender.avatar_url} alt={sender.full_name} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-xl text-[#E8748A]">{initials}</span>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${sender.username}`} className="block font-display text-4xl tracking-wide leading-none">
            {sender.full_name.toUpperCase()}
          </Link>
          <p className="font-fraunces italic text-base text-[#1a1a1a] mt-1">Accept to open a chat. You will follow each other.</p>
          <div className="flex items-center gap-2 mt-2">
            {skill != null && (
              <span className="rounded-full text-[9px] tracking-[0.12em] uppercase font-semibold bg-[#F0EBE3] text-[#E8748A] px-2.5 py-0.5">
                {skillLabel(skill)}
              </span>
            )}
            {sender.city_name && <span className="text-[11px] text-[#1a1a1a]/70">{sender.city_name}</span>}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button onClick={async () => { setActing('accept'); await onAccept(req.id, req.sender_id) }} disabled={acting !== null}
          className="flex-1 rounded-full py-3 bg-[#F0EBE3] text-[#1a1a1a] text-[11px] tracking-[0.16em] uppercase font-medium hover:bg-white transition-colors disabled:opacity-50">
          {acting === 'accept' ? 'Opening chat…' : 'Accept'}
        </button>
        <button onClick={async () => { setActing('decline'); await onDecline(req.id) }} disabled={acting !== null}
          className="flex-1 rounded-full py-3 border border-[#1a1a1a]/40 text-[11px] tracking-[0.16em] uppercase font-medium text-[#1a1a1a] hover:bg-[#1a1a1a]/10 transition-colors disabled:opacity-50">
          {acting === 'decline' ? 'Declining…' : 'Decline'}
        </button>
      </div>
    </div>
  )
}

// ─── Participant avatars ───────────────────────────────────────────────────────

function ParticipantAvatars({ participants, max = 3 }: { participants: OpenGameParticipant[]; max?: number }) {
  const shown = participants.slice(0, max)
  const extra = participants.length - max
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => {
        const initials = p.profile.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
        return (
          <div key={p.player_id} className="w-7 h-7 rounded-full border-2 border-white bg-brand-surface overflow-hidden flex items-center justify-center">
            {p.profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.profile.avatar_url} alt={p.profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[8px] font-medium text-[rgba(26,26,26,0.5)]">{initials}</span>
            )}
          </div>
        )
      })}
      {extra > 0 && (
        <div className="w-7 h-7 rounded-full border-2 border-white bg-brand-surface flex items-center justify-center">
          <span className="text-[8px] font-medium text-[rgba(26,26,26,0.5)]">+{extra}</span>
        </div>
      )}
    </div>
  )
}

const OPEN_FORMAT_LABELS: Record<string, string> = { singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed' }

// ─── Open game card ───────────────────────────────────────────────────────────

function OpenGameCard({ game, userId, joined, onJoin, onClick, vivid = true }: { game: OpenGame; userId: string | null; joined: boolean; onJoin: (id: string) => void; onClick: () => void; vivid?: boolean }) {
  const spotsTaken = game.participants.filter((p) => p.status === 'accepted' || p.status === 'invited').length
  const spotsLeft = game.max_players - spotsTaken
  const isFull = spotsLeft <= 0
  const isParticipant = userId ? game.participants.some((p) => p.player_id === userId) : false
  const alreadyIn = isParticipant || joined

  return (
    <button onClick={onClick} className={vivid ? 'w-full overflow-hidden rounded-[28px] text-left bg-[#3A8A7A] text-[#F0EBE3] active:bg-[#2d7066]' : 'w-full text-left bg-white border border-brand-divider hover:border-brand-primary/40 transition-colors active:bg-brand-surface'}>
      <div className={vivid ? 'p-5' : 'p-4'}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {vivid && <p className="text-[10px] tracking-[0.22em] uppercase text-[#BCD85E] mb-2">✦ Open game</p>}
            <p className={vivid ? 'font-display text-6xl tracking-wide leading-none' : 'font-display text-xl tracking-wide leading-none text-[#1a1a1a]'}>
              <LocalGameDay iso={game.scheduled_at} /> <LocalGameMonth iso={game.scheduled_at} />
              {vivid ? null : <> · <LocalGameTime iso={game.scheduled_at} /></>}
            </p>
            <p className={vivid ? 'font-fraunces italic text-lg text-[#F0EBE3] mt-2' : 'hidden'}>
              <LocalGameTime iso={game.scheduled_at} />
              {' · '}
              {OPEN_FORMAT_LABELS[game.format] ?? game.format}{game.neighborhood ? ` · ${game.neighborhood}` : ''}
            </p>
            <div className={vivid ? 'hidden' : 'flex items-center gap-2 mt-1.5 flex-wrap'}>
              <span className="text-[10px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.5)]">{OPEN_FORMAT_LABELS[game.format] ?? game.format}</span>
              {game.neighborhood && (
                <span className="text-[10px] text-[rgba(26,26,26,0.45)] flex items-center gap-0.5"><MapPin size={9} />{game.neighborhood}</span>
              )}
            </div>
          </div>
          <span className={`text-[9px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 flex-shrink-0 ${vivid ? 'rounded-full px-3 bg-[#F0EBE3] text-[#3A8A7A]' : isFull ? 'bg-brand-surface text-[rgba(26,26,26,0.35)]' : 'bg-brand-primary/10 text-brand-primary'}`}>
            {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2">
            <ParticipantAvatars participants={game.participants} />
            <span className={vivid ? 'text-[11px] text-[#F0EBE3]/80' : 'text-[10px] text-[rgba(26,26,26,0.4)]'}>{spotsTaken}/{game.max_players}</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); if (!alreadyIn && !isFull) onJoin(game.id) }}
            disabled={alreadyIn || isFull}
            className={`px-4 py-2 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors ${vivid ? 'rounded-full px-5' : ''} ${alreadyIn || isFull ? (vivid ? 'bg-[#F0EBE3]/20 text-[#F0EBE3]/70 cursor-default' : 'bg-brand-surface text-[rgba(26,26,26,0.35)] cursor-default') : vivid ? 'bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]' : 'rounded-full bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'}`}>
            {alreadyIn ? "You're in" : isFull ? 'Full' : 'Join'}
          </button>
        </div>
      </div>
    </button>
  )
}

// ─── Open game sheet ──────────────────────────────────────────────────────────

function OpenGameSheet({ game, userId, joined, onJoin, onClose }: { game: OpenGame; userId: string | null; joined: boolean; onJoin: (id: string) => void; onClose: () => void }) {
  const spotsTaken = game.participants.filter((p) => p.status === 'accepted' || p.status === 'invited').length
  const spotsLeft = game.max_players - spotsTaken
  const isFull = spotsLeft <= 0
  const isParticipant = userId ? game.participants.some((p) => p.player_id === userId) : false
  const alreadyIn = isParticipant || joined
  const creatorSkill = game.creator.skill_level_computed ?? game.creator.skill_level_self

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-[28px] max-h-[85vh] overflow-y-auto md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:rounded-[28px] md:shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-divider">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium">Open Game</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]"><X size={16} /></button>
        </div>
        <div className="p-5 pb-24 space-y-5">
          <div>
            <p className="font-display text-3xl tracking-wide leading-none text-[#1a1a1a]">
              <LocalGameDay iso={game.scheduled_at} /> <LocalGameMonth iso={game.scheduled_at} />
            </p>
            <p className="font-display text-xl tracking-wide text-brand-primary mt-1"><LocalGameTime iso={game.scheduled_at} /></p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[rgba(26,26,26,0.5)]">{OPEN_FORMAT_LABELS[game.format] ?? game.format}</span>
              {game.neighborhood && <span className="text-[11px] text-[rgba(26,26,26,0.5)] flex items-center gap-1"><MapPin size={11} />{game.neighborhood}</span>}
              <span className={`text-[9px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 ${isFull ? 'bg-brand-surface text-[rgba(26,26,26,0.4)]' : 'bg-brand-primary/10 text-brand-primary'}`}>
                {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
              </span>
            </div>
            {game.notes && <p className="mt-2 text-sm text-[rgba(26,26,26,0.55)] italic">{game.notes}</p>}
          </div>
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-2">Organiser</p>
            <Link href={`/profile/${game.creator.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0">
                {game.creator.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={game.creator.avatar_url} alt={game.creator.full_name} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-sm text-[#1a1a1a]">{game.creator.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-display text-base tracking-wide leading-tight">{game.creator.full_name.toUpperCase()}</p>
                {creatorSkill != null && (
                  <span className="text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-1.5 py-0.5">
                    {skillLabel(creatorSkill)}
                  </span>
                )}
              </div>
            </Link>
          </div>
          {game.participants.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-2">Players · {spotsTaken}/{game.max_players}</p>
              <div className="space-y-2">
                {game.participants.map((p) => {
                  const pSkill = p.profile.skill_level_computed ?? p.profile.skill_level_self
                  const pInitials = p.profile.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                  return (
                    <Link key={p.player_id} href={`/profile/${p.profile.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-9 h-9 rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {p.profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profile.avatar_url} alt={p.profile.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-sm text-[#1a1a1a]">{pInitials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{p.profile.full_name}</p>
                        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{p.profile.username}</p>
                      </div>
                      {pSkill != null && (
                        <span className="text-[9px] tracking-[0.1em] uppercase text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                          {skillLabel(pSkill)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
          <button onClick={() => { if (!alreadyIn && !isFull) onJoin(game.id) }} disabled={alreadyIn || isFull}
            className={`w-full py-4 rounded-full text-[10px] tracking-[0.2em] uppercase font-medium transition-colors ${alreadyIn || isFull ? 'bg-brand-field text-[rgba(26,26,26,0.55)] cursor-default' : 'bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'}`}>
            {alreadyIn ? "You're in" : isFull ? 'Game is full' : 'Join game'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function PlayerCardSkeleton() {
  return (
    <div className="bg-white rounded-[28px] p-4 flex gap-3 animate-pulse">
      <div className="w-14 h-14 bg-brand-surface-md flex-shrink-0" />
      <div className="flex-1 space-y-2 py-1">
        <div className="h-3.5 bg-brand-surface-md rounded w-1/3" />
        <div className="h-3 bg-brand-surface rounded w-1/2" />
        <div className="flex gap-2 pt-1">
          <div className="h-5 w-16 bg-brand-surface rounded" />
          <div className="h-5 w-20 bg-brand-surface rounded" />
        </div>
      </div>
    </div>
  )
}

function GameCardSkeleton() {
  return (
    <div className="bg-white rounded-[28px] p-4 animate-pulse space-y-2">
      <div className="h-5 bg-brand-surface-md w-2/5 rounded" />
      <div className="h-3 bg-brand-surface w-1/3 rounded" />
      <div className="h-8 bg-brand-surface w-full rounded mt-3" />
    </div>
  )
}

function CourtCardSkeleton() {
  return (
    <div className="bg-white rounded-[28px] flex animate-pulse overflow-hidden">
      <div className="w-20 h-20 bg-brand-surface-md flex-shrink-0" />
      <div className="flex-1 p-3 space-y-2">
        <div className="h-4 bg-brand-surface-md rounded w-1/2" />
        <div className="h-3 bg-brand-surface rounded w-2/3" />
        <div className="flex gap-2">
          <div className="h-4 w-10 bg-brand-surface rounded" />
          <div className="h-4 w-12 bg-brand-surface rounded" />
        </div>
      </div>
    </div>
  )
}

// ─── Discovery section wrapper ─────────────────────────────────────────────────

function DiscoverySection({ title, onSeeAll, children }: { title: string; onSeeAll: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-end justify-between mb-3">
        <span className="font-display text-4xl tracking-wide leading-none text-[#1a1a1a]">{title}</span>
        <button onClick={onSeeAll} className="flex items-center gap-1 text-[11px] tracking-[0.14em] uppercase text-[#1E3A6E] font-medium hover:underline pb-1">
          See all <ChevronRight size={11} />
        </button>
      </div>
      {children}
    </div>
  )
}

// ─── No city state ─────────────────────────────────────────────────────────────

function NoCityState({ guest, onBrowseCourts, vivid = true }: { guest?: boolean; onBrowseCourts?: () => void; vivid?: boolean }) {
  if (vivid) {
    return (
      <div className="rounded-[28px] bg-[#E8748A] text-[#1a1a1a] px-5 py-8 space-y-3">
        <p className="text-[10px] tracking-[0.22em] uppercase text-[#1a1a1a]/70">✦ No city yet</p>
        <p className="font-display text-5xl leading-none tracking-wide">WHERE DO YOU PLAY?</p>
        <p className="font-fraunces italic text-lg text-[#1a1a1a]">
          {guest
            ? 'Create an account and add your city. Courts are open without one.'
            : 'Add your city so Discover can find games near you'}
        </p>
        <div className="flex flex-col items-start gap-3 pt-2">
          {guest ? (
            <Link href="/sign-up" className="inline-block rounded-full px-5 py-3 bg-[#F0EBE3] text-[#1a1a1a] text-[11px] tracking-[0.16em] uppercase font-medium">
              Create free account
            </Link>
          ) : (
            <a href="/me/edit" className="inline-block rounded-full px-5 py-3 bg-[#F0EBE3] text-[#1a1a1a] text-[11px] tracking-[0.16em] uppercase font-medium">
              Add city
            </a>
          )}
          {onBrowseCourts && (
            <button type="button" onClick={onBrowseCourts} className="text-[11px] tracking-[0.14em] uppercase font-medium text-[#1a1a1a] underline">
              Browse courts
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 px-4 py-10 text-center space-y-3">
      <MapPin size={24} className="mx-auto text-[rgba(26,26,26,0.2)]" />
      <div>
        <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium mb-1">No city set</p>
        <p className="text-sm text-[rgba(26,26,26,0.55)]">
          {guest
            ? 'Create an account and add your city to see players and games. You can look up courts without an account.'
            : 'Add your city so Discover can show players, games, and courts near you.'}
        </p>
      </div>
      <div className="flex flex-col items-center gap-2">
        {guest ? (
          <Link href="/sign-up" className="inline-block px-5 py-2.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors">
            Create free account
          </Link>
        ) : (
          <a href="/me/edit" className="inline-block px-5 py-2.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors">
            Add city
          </a>
        )}
        {onBrowseCourts && (
          <button type="button" onClick={onBrowseCourts} className="text-[11px] text-brand-primary tracking-[0.1em] uppercase font-medium hover:underline">
            Browse courts
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Courts city persistence ───────────────────────────────────────────────────

const COURTS_CITY_KEY = 'courts_last_city'

interface SavedCourtsCity {
  name: string
  label: string
  lat: number
  lng: number
  south: number
  north: number
  west: number
  east: number
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SearchClient({ user, userCityName, initialIncoming }: { user: User | null; userCityName: string | null; initialIncoming: IncomingRequest[] }) {
  const router = useRouter()

  // Navigation
  const [view, setView] = useState<View>('discovery')

  // Incoming game requests
  const [incomingRequests, setIncomingRequests] = useState<IncomingRequest[]>(initialIncoming)

  // Shared state (used by both discovery preview and full views)
  const [requestStatuses, setRequestStatuses] = useState<Record<string, RequestStatus>>({})
  const [joinedGameIds, setJoinedGameIds] = useState<Set<string>>(new Set())
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [selectedGame, setSelectedGame] = useState<OpenGame | null>(null)
  const [viewedVenues, setViewedVenues] = useState<Set<string>>(new Set())

  // ── Discovery previews ──────────────────────────────────────────────────────
  const [previewPlayer, setPreviewPlayer] = useState<Player | null>(null)
  const [previewGame, setPreviewGame] = useState<OpenGame | null>(null)
  const [previewVenue, setPreviewVenue] = useState<Venue | null>(null)
  const [previewCoords, setPreviewCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [loadingPreviewPlayer, setLoadingPreviewPlayer] = useState(!!userCityName)
  const [loadingPreviewGame, setLoadingPreviewGame] = useState(!!userCityName)
  const [loadingPreviewVenue, setLoadingPreviewVenue] = useState(!!userCityName)
  const discoveryLoaded = useRef(false)

  useEffect(() => {
    if (discoveryLoaded.current || !userCityName) return
    discoveryLoaded.current = true

    let playerLoaded = false
    async function loadPreviewPlayer(coords?: { lat: number; lng: number }) {
      playerLoaded = true
      const playerParams = new URLSearchParams({ city: userCityName! })
      if (user) playerParams.set('exclude', user.id)
      if (coords) {
        playerParams.set('lat', String(coords.lat))
        playerParams.set('lng', String(coords.lng))
      }
      try {
        const res = await fetch(`/api/players?${playerParams}`)
        const json = await res.json() as { players: Player[] }
        const first = json.players?.[0] ?? null
        setPreviewPlayer(first)
        if (user && first) {
          const statusRes = await fetch(`/api/game-requests?receiver_ids=${first.id}`)
          if (statusRes.ok) {
            const data = await statusRes.json() as { statuses: Record<string, string> }
            setRequestStatuses(data.statuses as Record<string, RequestStatus>)
          }
        }
      } catch {
        setPreviewPlayer(null)
      } finally {
        setLoadingPreviewPlayer(false)
      }
    }

    // Game preview
    fetch(`/api/open-games?city=${encodeURIComponent(userCityName)}`)
      .then((r) => r.json())
      .then((json: { games: OpenGame[] }) => setPreviewGame(json.games?.[0] ?? null))
      .catch(() => {})
      .finally(() => setLoadingPreviewGame(false))

    // Court preview — auto-geocode user's city
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(userCityName)}&format=json&limit=1&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } },
    )
      .then((r) => r.json())
      .then(async (results: NominatimPlace[]) => {
        const place = results[0]
        if (!place) {
          await loadPreviewPlayer()
          return
        }
        const bb = place.boundingbox.map(Number) as [number, number, number, number]
        const lat = (bb[0] + bb[1]) / 2
        const lng = (bb[2] + bb[3]) / 2
        setPreviewCoords({ lat, lng })
        await loadPreviewPlayer({ lat, lng })
        const res = await fetch(`/api/venues?south=${bb[0]}&west=${bb[2]}&north=${bb[1]}&east=${bb[3]}`)
        if (!res.ok) return
        const json = await res.json() as { venues: Venue[] }
        const sorted = (json.venues ?? []).sort(
          (a, b) => haversineMeters(lat, lng, a.lat, a.lng) - haversineMeters(lat, lng, b.lat, b.lng),
        )
        setPreviewVenue(sorted[0] ?? null)
      })
      .catch(async () => {
        if (!playerLoaded) await loadPreviewPlayer()
      })
      .finally(() => setLoadingPreviewVenue(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Full players view ───────────────────────────────────────────────────────
  const [players, setPlayers] = useState<Player[]>([])
  const [loadingPlayers, setLoadingPlayers] = useState(false)
  const [loadingMorePlayers, setLoadingMorePlayers] = useState(false)
  const [playersOffset, setPlayersOffset] = useState(0)
  const [hasMorePlayers, setHasMorePlayers] = useState(false)
  const [userGeoCoords, setUserGeoCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geocodeDone, setGeocodeDone] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const playersQueryKey = useRef('')

  // Geocode user city once so the full list sorts by distance, same as the preview.
  useEffect(() => {
    if (!userCityName) return
    if (previewCoords) {
      setUserGeoCoords(previewCoords)
      setGeocodeDone(true)
      return
    }
    let cancelled = false
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(userCityName)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } },
    )
      .then((r) => r.json())
      .then((results: Array<{ lat: string; lon: string }>) => {
        if (cancelled) return
        const p = results[0]
        if (p) setUserGeoCoords({ lat: parseFloat(p.lat), lng: parseFloat(p.lon) })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setGeocodeDone(true) })
    return () => { cancelled = true }
  }, [userCityName, previewCoords])

  async function fetchPlayers(offset: number, append: boolean) {
    if (!userCityName) return
    append ? setLoadingMorePlayers(true) : setLoadingPlayers(true)

    const params = new URLSearchParams({ offset: String(offset) })
    if (user) params.set('exclude', user.id)
    params.set('city', userCityName)
    if (userGeoCoords) {
      params.set('lat', String(userGeoCoords.lat))
      params.set('lng', String(userGeoCoords.lng))
    }

    try {
      const res = await fetch(`/api/players?${params}`)
      const json = await res.json() as { players: Player[]; hasMore: boolean }
      const loaded = json.players ?? []

      setPlayers((prev) => append ? [...prev, ...loaded] : loaded)
      setHasMorePlayers(json.hasMore ?? false)
      setPlayersOffset(offset + loaded.length)

      // Fetch request statuses for newly loaded players
      if (user && loaded.length > 0) {
        const ids = loaded.map((p) => p.id).join(',')
        const statusRes = await fetch(`/api/game-requests?receiver_ids=${ids}`)
        if (statusRes.ok) {
          const data = await statusRes.json() as { statuses: Record<string, string> }
          setRequestStatuses((prev) => ({ ...prev, ...(data.statuses as Record<string, RequestStatus>) }))
        }
      }
    } catch {
      if (!append) setPlayers([])
    } finally {
      append ? setLoadingMorePlayers(false) : setLoadingPlayers(false)
    }
  }

  useEffect(() => {
    if (view !== 'players' || !userCityName || !geocodeDone) return
    const key = userGeoCoords
      ? `${userGeoCoords.lat.toFixed(4)},${userGeoCoords.lng.toFixed(4)}`
      : 'city'
    if (playersQueryKey.current === key) return
    playersQueryKey.current = key
    setPlayersOffset(0)
    setHasMorePlayers(false)
    void fetchPlayers(0, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, userCityName, userGeoCoords, geocodeDone])

  // IntersectionObserver — load next page when sentinel is visible
  useEffect(() => {
    if (!sentinelRef.current || !hasMorePlayers || loadingMorePlayers) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchPlayers(playersOffset, true)
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMorePlayers, loadingMorePlayers, playersOffset])

  // ── Full games view ─────────────────────────────────────────────────────────
  const [openGames, setOpenGames] = useState<OpenGame[]>([])
  const [loadingOpenGames, setLoadingOpenGames] = useState(false)

  function loadGames() {
    if (!userCityName) return
    setLoadingOpenGames(true)
    fetch(`/api/open-games?city=${encodeURIComponent(userCityName)}`)
      .then((r) => r.json())
      .then((json: { games: OpenGame[] }) => setOpenGames(json.games ?? []))
      .catch(() => setOpenGames([]))
      .finally(() => setLoadingOpenGames(false))
  }

  // ── Full courts view ────────────────────────────────────────────────────────
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadingVenues, setLoadingVenues] = useState(false)
  const [locating, setLocating] = useState(false)
  const [loadingMoreVenues, setLoadingMoreVenues] = useState(false)
  const [venuesHasMore, setVenuesHasMore] = useState(false)
  const [venuesOffset, setVenuesOffset] = useState(0)
  const [currentBbox, setCurrentBbox] = useState<{ south: number; west: number; north: number; east: number } | null>(null)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [cityInput, setCityInput] = useState('')
  const [cityLabel, setCityLabel] = useState<string | null>(null)
  const [courtsError, setCourtsError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const skipAutocompleteRef = useRef(false)
  const courtsRestoredRef = useRef(false)
  const venuesRequestRef = useRef(0)

  // Restore last city when courts view opens
  useEffect(() => {
    if (view !== 'courts' || courtsRestoredRef.current || userCoords) return
    courtsRestoredRef.current = true
    try {
      const raw = localStorage.getItem(COURTS_CITY_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as SavedCourtsCity
      const coords = { lat: saved.lat, lng: saved.lng }
      skipAutocompleteRef.current = true
      setCityInput(saved.name)
      setCityLabel(saved.label)
      setUserCoords(coords)
      void loadVenuesByBbox(saved.south, saved.west, saved.north, saved.east, coords)
    } catch {
      // ignore malformed data
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  useEffect(() => {
    if (view !== 'courts') return
    if (skipAutocompleteRef.current) { skipAutocompleteRef.current = false; return }
    const q = cityInput.trim()
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
    setLoadingSuggestions(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=7&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } },
        )
        const results = (await res.json()) as NominatimPlace[]
        const places = results.filter((r) => r.class === 'place' || r.class === 'boundary' || r.class === 'landuse')
        setSuggestions((places.length ? places : results).slice(0, 5))
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoadingSuggestions(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityInput])

  async function loadVenuesByBbox(south: number, west: number, north: number, east: number, coords?: { lat: number; lng: number }) {
    const requestId = ++venuesRequestRef.current
    setLoadingVenues(true)
    setCourtsError(null)
    setShowSuggestions(false)
    setVenuesOffset(0)
    setVenuesHasMore(false)
    setCurrentBbox({ south, west, north, east })
    try {
      const params = new URLSearchParams({ south: String(south), west: String(west), north: String(north), east: String(east) })
      const res = await fetch(`/api/venues?${params}`)
      if (requestId !== venuesRequestRef.current) return
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { venues: Venue[]; hasMore: boolean }
      if (requestId !== venuesRequestRef.current) return
      setVenues(json.venues ?? [])
      setVenuesHasMore(json.hasMore ?? false)
      setVenuesOffset(json.venues?.length ?? 0)
    } catch {
      if (requestId !== venuesRequestRef.current) return
      setVenues([])
      setCourtsError('Failed to load courts. Please try again.')
    } finally {
      if (requestId === venuesRequestRef.current) setLoadingVenues(false)
    }
  }

  async function loadMoreVenues() {
    if (!currentBbox || loadingMoreVenues) return
    setLoadingMoreVenues(true)
    try {
      const { south, west, north, east } = currentBbox
      const params = new URLSearchParams({ south: String(south), west: String(west), north: String(north), east: String(east), offset: String(venuesOffset) })
      const res = await fetch(`/api/venues?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { venues: Venue[]; hasMore: boolean }
      setVenues((prev) => [...prev, ...(json.venues ?? [])])
      setVenuesHasMore(json.hasMore ?? false)
      setVenuesOffset((prev) => prev + (json.venues?.length ?? 0))
    } catch {
      // keep existing venues
    } finally {
      setLoadingMoreVenues(false)
    }
  }

  function selectSuggestion(place: NominatimPlace) {
    skipAutocompleteRef.current = true
    const name = place.name
    const label = place.name + (place.address?.country ? `, ${place.address.country}` : '')
    const bb = place.boundingbox.map(Number)
    const south = bb[0] ?? 0
    const north = bb[1] ?? 0
    const west = bb[2] ?? 0
    const east = bb[3] ?? 0
    const lat = (south + north) / 2
    const lng = (west + east) / 2
    const coords = { lat, lng }

    setCityInput(name)
    setCityLabel(label)
    setSuggestions([])
    setShowSuggestions(false)
    setUserCoords(coords)

    // Persist for next session
    const toSave: SavedCourtsCity = { name, label, lat, lng, south, north, west, east }
    localStorage.setItem(COURTS_CITY_KEY, JSON.stringify(toSave))

    void loadVenuesByBbox(south, west, north, east, coords)
  }

  function requestGeolocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setCourtsError('Geolocation is not supported by your browser')
      return
    }
    // Drop any in-flight search of the typed city. This click must use the device position.
    venuesRequestRef.current += 1
    const requestId = venuesRequestRef.current
    if (cityInput.trim()) skipAutocompleteRef.current = true
    setSuggestions([])
    setShowSuggestions(false)
    setCityInput('')
    setLocating(true)
    setCourtsError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (requestId !== venuesRequestRef.current) return
        const { latitude, longitude } = pos.coords
        const coords = { lat: latitude, lng: longitude }
        const { south, west, north, east } = boundingBoxClient(latitude, longitude, 10)
        setUserCoords(coords)
        setCityLabel('your location')
        setLocating(false)
        const toSave: SavedCourtsCity = { name: '', label: 'your location', lat: latitude, lng: longitude, south, north, west, east }
        localStorage.setItem(COURTS_CITY_KEY, JSON.stringify(toSave))
        void loadVenuesByBbox(south, west, north, east, coords)
      },
      () => {
        if (requestId !== venuesRequestRef.current) return
        setLocating(false)
        setCourtsError('Could not detect your location. Allow location access and try again.')
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    )
  }

  // ── Shared handlers ─────────────────────────────────────────────────────────

  function navigateTo(v: View) {
    setView(v)
    if (v === 'games' && openGames.length === 0) loadGames()
  }

  async function handleJoin(gameId: string) {
    setJoinedGameIds((prev) => new Set(prev).add(gameId))
    const res = await fetch(`/api/games/${gameId}/join`, { method: 'POST' })
    if (!res.ok) setJoinedGameIds((prev) => { const s = new Set(prev); s.delete(gameId); return s })
  }

  async function handleAccept(requestId: string, senderId: string) {
    const res = await fetch(`/api/game-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', sender_id: senderId }),
    })
    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId))
    if (res.ok) {
      const data = await res.json() as { conversation_id?: string }
      if (data.conversation_id) router.push(`/chats/${data.conversation_id}`)
    }
  }

  async function handleDecline(requestId: string) {
    await fetch(`/api/game-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    })
    setIncomingRequests((prev) => prev.filter((r) => r.id !== requestId))
  }

  async function handlePlayerRequest(playerId: string) {
    if (!user) {
      router.push('/sign-in?next=/search')
      return
    }
    setRequestStatuses((prev) => ({ ...prev, [playerId]: 'pending' }))
    const res = await fetch('/api/game-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: playerId }),
    })
    if (!res.ok) {
      setRequestStatuses((prev) => ({ ...prev, [playerId]: 'none' }))
      return
    }
    const data = await res.json() as { matched?: boolean }
    if (data.matched) setRequestStatuses((prev) => ({ ...prev, [playerId]: 'matched' }))
  }

  async function handleCancelRequest(playerId: string) {
    const previous = requestStatuses[playerId] ?? 'pending'
    setRequestStatuses((prev) => ({ ...prev, [playerId]: 'none' }))
    const res = await fetch(`/api/game-requests?receiver_id=${playerId}`, { method: 'DELETE' })
    if (!res.ok) setRequestStatuses((prev) => ({ ...prev, [playerId]: previous }))
  }

  function handlePlanGame(player: Player) {
    router.push(`/games/new?invite=${player.id}&name=${encodeURIComponent(player.full_name)}`)
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const pageHeader = (title: string, onBack: () => void) => (
    <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
      <div className="max-w-2xl mx-auto flex items-center gap-3">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
          <ChevronLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
        </button>
        <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">{title}</span>
      </div>
    </div>
  )

  // ── Sheets (always rendered) ────────────────────────────────────────────────
  const sheets = (
    <>
      {selectedVenue && (previewCoords || userCoords) && (
        <VenueSheet
          venue={selectedVenue}
          userLat={(previewCoords ?? userCoords)!.lat}
          userLng={(previewCoords ?? userCoords)!.lng}
          onClose={() => setSelectedVenue(null)}
        />
      )}
      {selectedGame && (
        <OpenGameSheet
          game={selectedGame}
          userId={user?.id ?? null}
          joined={joinedGameIds.has(selectedGame.id)}
          onJoin={(id) => { void handleJoin(id); setSelectedGame(null) }}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </>
  )

  // ── Discovery view ──────────────────────────────────────────────────────────

  if (view === 'discovery') {
    return (
      <div className="min-h-screen bg-[#FAF7F2] pb-20 md:pb-0">
        {sheets}

        <div className="max-w-2xl mx-auto px-4 pt-8 pb-2">
          <p className="text-[10px] tracking-[0.28em] uppercase text-[#85648F]">✦ The club</p>
          <h1 className="font-display text-7xl leading-[0.9] tracking-wide text-[#1a1a1a] mt-1">DISCOVER</h1>
          <p className="font-fraunces italic text-xl text-[#497250] mt-2">A game, a court, a partner</p>
        </div>

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
          {!user && (
            <div className="rounded-[28px] bg-[#1E3A6E] text-[#F0EBE3] px-5 py-5 flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl leading-none">JOIN FREE</p>
                <p className="font-fraunces italic text-base text-[#D4E040] mt-1">Play with people near you</p>
              </div>
              <Link href="/sign-up" className="flex-shrink-0 rounded-full px-4 py-2.5 bg-[#E8748A] text-[#1a1a1a] text-[11px] tracking-[0.14em] uppercase font-medium">Join</Link>
            </div>
          )}

          {incomingRequests.length > 0 && (
            <div className="space-y-3">
              {incomingRequests.map((req) => (
                <IncomingRequestCard key={req.id} req={req} onAccept={handleAccept} onDecline={handleDecline} />
              ))}
            </div>
          )}

          {!userCityName ? (
            <NoCityState guest={!user} onBrowseCourts={() => navigateTo('courts')} vivid />
          ) : (
            <>
              <DiscoverySection title="OPEN GAMES" onSeeAll={() => navigateTo('games')}>
                {loadingPreviewGame ? (
                  <GameCardSkeleton />
                ) : previewGame ? (
                  <OpenGameCard
                    game={previewGame}
                    userId={user?.id ?? null}
                    joined={joinedGameIds.has(previewGame.id)}
                    onJoin={handleJoin}
                    onClick={() => setSelectedGame(previewGame)}
                    vivid
                  />
                ) : (
                  <div className="rounded-[28px] bg-[#3A8A7A] text-[#F0EBE3] px-5 py-8 space-y-3">
                    <p className="font-display text-5xl leading-none">NO OPEN GAMES</p>
                    <p className="font-fraunces italic text-lg text-[#F0EBE3]">Nothing posted in {userCityName} yet</p>
                    {user && (
                      <Link href="/games/new" className="inline-flex items-center gap-1.5 rounded-full px-4 py-3 bg-[#E8748A] text-[#1a1a1a] text-[11px] tracking-[0.16em] uppercase font-medium">
                        <Plus size={12} /> Create a game
                      </Link>
                    )}
                  </div>
                )}
              </DiscoverySection>

              <DiscoverySection title="PLAYERS" onSeeAll={() => navigateTo('players')}>
                {loadingPreviewPlayer ? (
                  <PlayerCardSkeleton />
                ) : previewPlayer ? (
                  <PlayerCard
                    player={previewPlayer}
                    status={requestStatuses[previewPlayer.id] ?? 'none'}
                    onRequest={handlePlayerRequest}
                    onCancel={handleCancelRequest}
                    onPlan={handlePlanGame}
                    vivid
                  />
                ) : (
                  <div className="rounded-[28px] bg-white px-5 py-8">
                    <p className="font-display text-4xl leading-none text-[#1a1a1a]">NO PLAYERS YET</p>
                    <p className="font-fraunces italic text-[#85648F] mt-2">Invite someone in {userCityName} onto the court</p>
                  </div>
                )}
              </DiscoverySection>

              <DiscoverySection title="COURTS" onSeeAll={() => navigateTo('courts')}>
                {loadingPreviewVenue ? (
                  <CourtCardSkeleton />
                ) : previewVenue && previewCoords ? (
                  <VenueCard
                    venue={previewVenue}
                    userLat={previewCoords.lat}
                    userLng={previewCoords.lng}
                    viewed={viewedVenues.has(previewVenue.id)}
                    vivid
                    onClick={() => {
                      setSelectedVenue(previewVenue)
                      setViewedVenues((prev) => new Set(prev).add(previewVenue.id))
                    }}
                  />
                ) : (
                  <div className="rounded-[28px] bg-white px-5 py-8">
                    <p className="font-display text-4xl leading-none text-[#1a1a1a]">NO COURTS NEARBY</p>
                    <p className="font-fraunces italic text-[#85648F] mt-2">Try another area from the courts list</p>
                  </div>
                )}
              </DiscoverySection>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Players full view ───────────────────────────────────────────────────────

  if (view === 'players') {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        {sheets}
        {pageHeader('PLAYERS', () => setView('discovery'))}
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {!userCityName ? (
            <NoCityState guest={!user} onBrowseCourts={() => navigateTo('courts')} />
          ) : loadingPlayers || !geocodeDone ? (
            [...Array(4)].map((_, i) => <PlayerCardSkeleton key={i} />)
          ) : players.length === 0 ? (
            <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 px-4 py-8 text-center">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">No players found</p>
              <p className="text-sm text-[rgba(26,26,26,0.5)]">No players in {userCityName} yet</p>
            </div>
          ) : (
            <>
              <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                Players near {userCityName}
              </p>
              {players.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  status={requestStatuses[player.id] ?? 'none'}
                  onRequest={handlePlayerRequest}
                  onCancel={handleCancelRequest}
                  onPlan={handlePlanGame}
                />
              ))}

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} />

              {loadingMorePlayers && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
                </div>
              )}

              {!hasMorePlayers && players.length > 0 && (
                <p className="text-center text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.25)] py-4">
                  All players shown
                </p>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Games full view ─────────────────────────────────────────────────────────

  if (view === 'games') {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        {sheets}
        {pageHeader('OPEN GAMES', () => setView('discovery'))}
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
          {!userCityName ? (
            <NoCityState guest={!user} onBrowseCourts={() => navigateTo('courts')} />
          ) : loadingOpenGames ? (
            [...Array(3)].map((_, i) => <GameCardSkeleton key={i} />)
          ) : openGames.length === 0 ? (
            <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 px-4 py-8 text-center space-y-3">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">No open games in {userCityName}</p>
              {user && (
                <Link href="/games/new" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors">
                  <Plus size={12} /> Create a game
                </Link>
              )}
            </div>
          ) : (
            <>
              <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                {openGames.length} game{openGames.length !== 1 ? 's' : ''} in {userCityName}
              </p>
              {openGames.map((game) => (
                <OpenGameCard
                  key={game.id}
                  game={game}
                  userId={user?.id ?? null}
                  joined={joinedGameIds.has(game.id)}
                  onJoin={handleJoin}
                  onClick={() => setSelectedGame(game)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Courts full view ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {sheets}
      {pageHeader('COURTS', () => setView('discovery'))}
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {/* City search */}
        <div className="relative">
          <div className="flex gap-2">
            <input
              type="text"
              value={cityInput}
              onChange={(e) => { setCityInput(e.target.value); setShowSuggestions(true) }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search city or area..."
              className="flex-1 bg-brand-field border border-[#1a1a1a]/40 rounded-lg px-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:border-brand-primary placeholder:text-[rgba(26,26,26,0.4)]"
            />
            {loadingSuggestions && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="w-3.5 h-3.5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
              </div>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 z-20 bg-white border border-[#1a1a1a]/15 rounded-lg shadow-sm mt-1 overflow-hidden">
              {suggestions.map((place) => {
                const country = place.address?.country
                const subtitle = [place.address?.city ?? place.address?.town, country].filter(Boolean).join(', ')
                return (
                  <button key={place.place_id} onMouseDown={() => selectSuggestion(place)}
                    className="w-full text-left px-4 py-2.5 hover:bg-brand-surface transition-colors border-b border-brand-divider last:border-0">
                    <p className="text-sm text-[#1a1a1a]">{place.name}</p>
                    {subtitle && subtitle !== place.name && <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">{subtitle}</p>}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={requestGeolocation}
          disabled={loadingVenues || locating}
          className="relative z-30 -mt-1 flex items-center gap-1.5 text-[11px] text-brand-primary tracking-[0.1em] uppercase font-medium hover:underline disabled:opacity-40"
        >
          <MapPin size={11} /> {locating ? 'Detecting location...' : 'Use my location'}
        </button>

        {courtsError && <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{courtsError}</p>}

        {(loadingVenues || locating) && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-5 h-5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
            <p className="text-[11px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
              {locating ? 'Detecting your location...' : `Finding courts${cityLabel ? ` near ${cityLabel}` : ''}...`}
            </p>
          </div>
        )}

        {!loadingVenues && !locating && userCoords && venues.length === 0 && !courtsError && (
          <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 px-4 py-6 text-center">
            <p className="text-sm text-[rgba(26,26,26,0.6)]">No courts found in this area</p>
          </div>
        )}

        {!loadingVenues && !locating && userCoords && venues.length > 0 && (
          <>
            {cityLabel && (
              <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                Courts near {cityLabel}
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
                  setViewedVenues((prev) => new Set(prev).add(venue.id))
                }}
              />
            ))}
            {venuesHasMore && (
              <button
                onClick={() => void loadMoreVenues()}
                disabled={loadingMoreVenues}
                className="w-full py-3 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors disabled:opacity-40"
              >
                {loadingMoreVenues ? 'Loading...' : 'Load more'}
              </button>
            )}
          </>
        )}

        {!loadingVenues && !locating && !userCoords && (
          <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 px-4 py-8 text-center">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">Enter a city to find courts</p>
            <p className="text-sm text-[rgba(26,26,26,0.5)]">Or use your location for the nearest courts</p>
          </div>
        )}
      </div>
    </div>
  )
}
