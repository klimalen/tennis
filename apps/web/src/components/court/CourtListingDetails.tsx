import Link from 'next/link'
import { ArrowUpRight, Globe, MapPin, Phone } from 'lucide-react'
import { OpeningHours } from '@/components/court/OpeningHours'
import { buildCourtFactChips, CourtFactChips, type CourtFactChip } from '@/components/court/CourtFactChips'
import { CourtVerifiedBadge } from '@/components/court/CourtVerifiedBadge'
import { courtMapsHref } from '@/components/court/CourtProfileDetails'
import { arrivalLabel } from '@/lib/game-court'

const secondaryBtn =
  'flex items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-brand-field px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a] transition-colors hover:bg-white'

const profileBtn =
  'flex items-center justify-center gap-2 rounded-full bg-[#E8748A] px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a] transition-colors hover:bg-[#E8406A]'

export type CourtListingData = {
  id: string
  name: string
  kind?: string
  address: string | null
  city_name?: string | null
  description?: string | null
  opening_hours?: string | null
  website?: string | null
  phone?: string | null
  surface?: string | null
  surfaces?: string[] | null
  court_count?: number | null
  lit?: boolean | null
  has_indoor?: boolean | null
  has_outdoor?: boolean | null
  fee?: boolean | null
  fee_hour_min?: number | null
  fee_hour_max?: number | null
  access?: string | null
  google_maps_uri?: string | null
  lat?: number | null
  lng?: number | null
  profile_username?: string | null
  court_verified?: boolean
}

export function courtListingMapsHref(court: CourtListingData, title: string): string {
  if (court.google_maps_uri) return court.google_maps_uri
  if (court.address?.trim()) return courtMapsHref(court.address, court.city_name)
  if (court.lat != null && court.lng != null) {
    return `https://www.google.com/maps/search/${encodeURIComponent(title)}/@${court.lat},${court.lng},17z`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`
}

export function courtListingChips(court: CourtListingData): CourtFactChip[] {
  const closed = court.access === 'private' || court.access === 'members'
  const accessLabel = closed ? (court.access === 'members' ? 'Members only' : 'Private') : null
  const chips = buildCourtFactChips({
    courtCount: court.court_count,
    surfaces: court.surfaces,
    surface: court.surface,
    hasIndoor: court.has_indoor,
    hasOutdoor: court.has_outdoor,
    lit: court.lit,
    feeHourMin: court.fee_hour_min,
    feeHourMax: court.fee_hour_max,
    fee: court.fee,
    accessLabel,
  })
  const arrival = arrivalLabel({ fee: court.fee ?? null, access: court.access ?? null })
  if (arrival) chips.push({ key: 'arrival', label: arrival, tone: 'feature' })
  return chips
}

/** Shared body for `/court/[id]` and the discover court sheet. */
export function CourtListingDetails({
  court,
  title,
  kindLabel,
  distance,
  saveAction,
  reportHref,
  profileHref,
}: {
  court: CourtListingData
  title: string
  kindLabel?: string | null
  distance?: string | null
  saveAction?: React.ReactNode
  reportHref: string
  profileHref?: string | null
}) {
  const placeLine = [court.address?.trim(), court.city_name?.trim()].filter(Boolean).join(', ')
  const mapsHref = courtListingMapsHref(court, title)
  const websiteHref = court.website
    ? (court.website.startsWith('http') ? court.website : `https://${court.website}`)
    : null
  const chips = courtListingChips(court)
  const verified = Boolean(court.court_verified || court.profile_username)
  const profileLink = profileHref ?? (court.profile_username ? `/profile/${court.profile_username}` : null)

  return (
    <div className="space-y-4">
      <div>
        {kindLabel && (
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[rgba(26,26,26,0.4)]">{kindLabel}</p>
        )}
        <div className={`flex items-start justify-between gap-3 ${kindLabel ? 'mt-1' : ''}`}>
          <h2 className="flex min-w-0 items-center gap-1.5 font-display text-2xl leading-none tracking-wide uppercase text-[#1a1a1a] md:text-3xl">
            <span className="min-w-0">{title}</span>
            {verified && <CourtVerifiedBadge className="flex-shrink-0" />}
          </h2>
          {distance && (
            <span className="mt-1 flex flex-shrink-0 items-center gap-1 text-[11px] text-[rgba(26,26,26,0.45)]">
              <MapPin size={11} />{distance}
            </span>
          )}
        </div>
        {placeLine && placeLine !== title && (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-2 flex items-start gap-1.5 text-[12px] font-medium text-[#1a1a1a] transition-opacity hover:opacity-75"
          >
            <MapPin size={12} className="mt-0.5 flex-shrink-0 text-[#1a1a1a]" />
            <span className="underline-offset-2 group-hover:underline">{placeLine}</span>
            <ArrowUpRight size={12} className="mt-0.5 flex-shrink-0 text-[rgba(26,26,26,0.45)]" aria-hidden />
          </a>
        )}
      </div>

      <CourtFactChips chips={chips} className="flex flex-wrap gap-1.5" />

      {court.description?.trim() && (
        <p className="font-copy text-sm leading-relaxed text-[rgba(26,26,26,0.65)]">{court.description}</p>
      )}

      {court.opening_hours?.trim() && <OpeningHours hours={court.opening_hours} />}

      <div className="grid grid-cols-1 gap-2 pt-1">
        {profileLink && (
          <Link href={profileLink} className={profileBtn}>
            Open court profile
          </Link>
        )}

        {(websiteHref || court.phone) && (
          <div className={`grid gap-2 ${websiteHref && court.phone ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {websiteHref && (
              <a href={websiteHref} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
                <Globe size={13} /> Website
              </a>
            )}
            {court.phone && (
              <a href={`tel:${court.phone}`} className={secondaryBtn}>
                <Phone size={13} /> {court.phone}
              </a>
            )}
          </div>
        )}

        {saveAction}
      </div>

      <Link
        href={reportHref}
        className="block px-2 text-center font-copy text-[12px] leading-snug text-[rgba(26,26,26,0.45)] underline decoration-[rgba(26,26,26,0.28)] underline-offset-[3px] hover:text-[#1a1a1a]"
      >
        Found an error, or is this your court?<br />
        Write to us — we&apos;ll fix it or add more detail.
      </Link>
    </div>
  )
}
