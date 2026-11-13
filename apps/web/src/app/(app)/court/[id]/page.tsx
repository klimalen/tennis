import type { Metadata } from 'next'
import Link from 'next/link'
import { permanentRedirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CourtMapFrame } from '@/components/court/CourtMapFrame'
import { CourtListingDetails } from '@/components/court/CourtListingDetails'
import { CourtSaveButton } from '@/components/court/CourtSaveButton'
import { LinkState } from '@/components/share/LinkState'
import { ShareLinkButton } from '@/components/share/ShareLinkButton'
import { createClient } from '@/lib/supabase/server'
import { courtReportHref } from '@/lib/court-report'
import { isUuid } from '@/lib/public-game'
import { loadPublicCourt, type PublicCourt } from '@/lib/public-court'
import { courtTitle, venueKindLabel } from '@/lib/venue-label'
import { returnToFromSearch, withReturnTo } from '@/lib/return-to'

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
        <div className="rounded-[28px] bg-white p-5">
          <CourtListingDetails
            court={court}
            title={title.toUpperCase()}
            kindLabel={venueKindLabel(court.kind)}
            reportHref={courtReportHref({ id: court.id, name: title, address: court.address })}
            saveAction={<CourtSaveButton venueId={court.id} signedIn={Boolean(user)} />}
          />
        </div>
      </div>
    </div>
  )
}
