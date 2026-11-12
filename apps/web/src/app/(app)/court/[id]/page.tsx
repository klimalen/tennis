import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import { ArrowLeft, Globe, MapPin, Navigation, Phone } from 'lucide-react'
import { CourtMapFrame } from '@/components/court/CourtMapFrame'
import { OpeningHours } from '@/components/court/OpeningHours'
import { CourtSaveButton } from '@/components/court/CourtSaveButton'
import { LinkState } from '@/components/share/LinkState'
import { ShareLinkButton } from '@/components/share/ShareLinkButton'
import { createClient } from '@/lib/supabase/server'
import { arrivalLabel } from '@/lib/game-court'
import { courtReportHref } from '@/lib/court-report'
import { isUuid } from '@/lib/public-game'
import { loadPublicCourt, type PublicCourt } from '@/lib/public-court'
import { courtTitle, venueKindLabel } from '@/lib/venue-label'
import { returnToFromSearch, withReturnTo } from '@/lib/return-to'

function mapsHref(court: PublicCourt) {
  if (court.google_maps_uri) return court.google_maps_uri
  return `https://www.google.com/maps/search/${encodeURIComponent(courtTitle(court.name, court.address))}/@${court.lat},${court.lng},17z`
}

function courtDescription(court: PublicCourt) {
  return [venueKindLabel(court.kind), court.address].filter(Boolean).join(' · ')
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  if (!isUuid(id)) return { title: 'Court on GAME.' }
  const supabase = await createClient()
  const result = await loadPublicCourt(supabase, id)
  if (!result || 'redirectTo' in result) return { title: 'Court on GAME.' }
  const title = `${courtTitle(result.court.name, result.court.address)} on GAME.`
  const description = courtDescription(result.court)
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function CourtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ from?: string | string[] }>
}) {
  const { id } = await params
  const query = await searchParams
  const backHref = returnToFromSearch(query.from)
  if (!isUuid(id)) {
    return <LinkState title="COURT NOT FOUND" body="This court isn't in the catalog." action={{ href: '/search', label: 'Browse courts' }} />
  }

  const supabase = await createClient()
  const [{ data: { user } }, result] = await Promise.all([
    supabase.auth.getUser(),
    loadPublicCourt(supabase, id),
  ])

  if (!result) {
    return <LinkState title="COURT NOT FOUND" body="This court isn't in the catalog." action={{ href: '/search', label: 'Browse courts' }} />
  }
  if ('redirectTo' in result) {
    const from = returnToFromSearch(query.from, '')
    permanentRedirect(from ? withReturnTo(`/court/${result.redirectTo}`, from) : `/court/${result.redirectTo}`)
  }

  const court = result.court
  const title = courtTitle(court.name, court.address)
  const website = court.website ? (court.website.startsWith('http') ? court.website : `https://${court.website}`) : null
  const closed = court.access === 'private' || court.access === 'members'

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={backHref} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="flex-1 truncate font-display text-2xl tracking-wide text-[#1a1a1a]">{title.toUpperCase()}</span>
          <ShareLinkButton path={`/court/${court.id}`} title={`${title} on GAME.`} text={`${title} on GAME.`} />
        </div>
      </div>
      <div className="max-w-2xl mx-auto space-y-4 px-4 py-4">
        <CourtMapFrame lat={court.lat} lng={court.lng} name={title} />
        <div className="space-y-4 rounded-[28px] bg-white p-5">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[rgba(26,26,26,0.4)]">{venueKindLabel(court.kind)}</p>
            <h1 className="mt-1 font-display text-3xl leading-none tracking-wide text-[#1a1a1a]">{title.toUpperCase()}</h1>
            {court.address && court.address !== title && (
              <p className="mt-2 flex items-center gap-1 text-[12px] text-[rgba(26,26,26,0.5)]">
                <MapPin size={11} /> {court.address}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {court.surface && <Fact>{court.surface.replace(/_/g, ' ')}</Fact>}
            {court.court_count != null && <Fact>{`${court.court_count} ${court.court_count === 1 ? 'court' : 'courts'}`}</Fact>}
            {court.lit && <Fact>Floodlit</Fact>}
            {court.has_indoor && <Fact>Indoor</Fact>}
            {court.has_outdoor && court.has_indoor && <Fact>Outdoor</Fact>}
            {court.fee === false && <Fact>Free</Fact>}
            {court.fee === true && <Fact>Fee</Fact>}
            {arrivalLabel(court) && <Fact>{arrivalLabel(court)}</Fact>}
            {closed && <Fact>{court.access === 'members' ? 'Members only' : 'Private'}</Fact>}
          </div>
          {court.description && <p className="font-copy text-sm leading-relaxed text-[rgba(26,26,26,0.65)]">{court.description}</p>}
          {court.opening_hours && <OpeningHours hours={court.opening_hours} />}
          <p className="text-[12px] text-[rgba(26,26,26,0.5)]">Booking isn't available in the app yet. Open the court in Google Maps to get there.</p>
          <div className="grid grid-cols-1 gap-2">
            <CourtSaveButton venueId={court.id} signedIn={Boolean(user)} />
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-brand-field px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a]">
                <Globe size={13} /> Website
              </a>
            )}
            {court.phone && (
              <a href={`tel:${court.phone}`} className="flex items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-brand-field px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a]">
                <Phone size={13} /> {court.phone}
              </a>
            )}
            {court.profile_username && (
              <Link href={`/profile/${court.profile_username}`} className="flex items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-brand-field px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a]">
                Open court profile
              </Link>
            )}
            <a href={mapsHref(court)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-full bg-[#E8748A] px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a]">
              <Navigation size={13} /> View on Google Maps
            </a>
          </div>
          <Link href={courtReportHref({ id: court.id, name: title, address: court.address })} className="block px-2 text-center font-copy text-[12px] leading-snug text-[rgba(26,26,26,0.45)] underline decoration-[rgba(26,26,26,0.28)] underline-offset-[3px]">
            Found an error, or is this your court?<br />Write to us — we'll fix it or add more detail.
          </Link>
        </div>
      </div>
    </div>
  )
}

function Fact({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 border border-brand-divider px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-[rgba(26,26,26,0.55)]">{children}</span>
}
