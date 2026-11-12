import { ImageResponse } from 'next/og'
import { shareCard } from '@/components/share/share-card'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/public-game'
import { loadPublicCourt } from '@/lib/public-court'
import { courtTitle, venueKindLabel } from '@/lib/venue-label'

export const alt = 'Court on GAME.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function CourtImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const missing = shareCard({ kicker: 'Court', title: 'Court', line: 'This court isn’t in the catalog.' })
  if (!isUuid(id)) return new ImageResponse(missing, { ...size })

  const supabase = await createClient()
  const result = await loadPublicCourt(supabase, id)
  const court = result && 'court' in result ? result.court : null
  if (!court) return new ImageResponse(missing, { ...size })

  return new ImageResponse(
    shareCard({
      kicker: 'Court',
      title: courtTitle(court.name, court.address),
      line: [venueKindLabel(court.kind), court.address].filter(Boolean).join(' · '),
    }),
    { ...size },
  )
}
