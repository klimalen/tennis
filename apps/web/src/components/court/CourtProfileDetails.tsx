import { Globe, MapPin, Phone } from 'lucide-react'
import { OpeningHours } from '@/components/court/OpeningHours'
import { ExpandableText } from '@/components/ui/ExpandableText'

const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  indoor: 'Indoor',
}

export function courtMapsHref(address: string, city?: string | null): string {
  const query = [address.trim(), city?.trim()].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function whatsappHref(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return `https://wa.me/${digits.replace(/\D/g, '')}`
  if (/^\d+$/.test(digits)) return `https://wa.me/${digits}`
  return `https://wa.me/${encodeURIComponent(raw.trim())}`
}

function instagramHref(handle: string): string {
  const clean = handle.trim().replace(/^@+/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/\/$/, '')
  return `https://instagram.com/${encodeURIComponent(clean)}`
}

function telegramHref(handle: string): string {
  const clean = handle.trim().replace(/^@+/, '').replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
  return `https://t.me/${encodeURIComponent(clean)}`
}

function facebookHref(raw: string): string {
  const trimmed = raw.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  const clean = trimmed.replace(/^@+/, '').replace(/^facebook\.com\//i, '')
  return `https://facebook.com/${encodeURIComponent(clean)}`
}

function SocialChip({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center min-w-[2.25rem] h-9 px-3 rounded-full bg-brand-field border border-[#1a1a1a]/12 text-[10px] tracking-[0.14em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors"
    >
      {label}
    </a>
  )
}

export function CourtProfileDetails({
  cityName,
  address,
  phone,
  website,
  openingHours,
  bio,
  showPhone = true,
  courtCount,
  surfaces,
  lit,
  feeHourMin,
  feeHourMax,
  whatsapp,
  instagram,
  telegram,
  facebook,
}: {
  cityName?: string | null
  address?: string | null
  phone?: string | null
  website?: string | null
  openingHours?: string | null
  bio?: string | null
  showPhone?: boolean
  courtCount?: number | null
  surfaces?: string[] | null
  lit?: boolean | null
  feeHourMin?: number | null
  feeHourMax?: number | null
  whatsapp?: string | null
  instagram?: string | null
  telegram?: string | null
  facebook?: string | null
}) {
  const websiteHref = website
    ? (website.startsWith('http') ? website : `https://${website}`)
    : null
  const mapsHref = address?.trim() ? courtMapsHref(address, cityName) : null
  const placeLine = [address?.trim(), cityName?.trim()].filter(Boolean).join(', ')
  const surfaceLabels = (surfaces ?? []).map((s) => SURFACE_LABELS[s] ?? s).filter(Boolean)
  const feeLine = (() => {
    if (feeHourMin == null && feeHourMax == null) return null
    if (feeHourMin != null && feeHourMax != null) {
      if (feeHourMin === feeHourMax) return `${feeHourMin}/hr`
      return `${feeHourMin}–${feeHourMax}/hr`
    }
    if (feeHourMin != null) return `from ${feeHourMin}/hr`
    return `up to ${feeHourMax}/hr`
  })()
  const facts = [
    courtCount != null ? `${courtCount} court${courtCount === 1 ? '' : 's'}` : null,
    surfaceLabels.length ? surfaceLabels.join(' · ') : null,
    lit === true ? 'Lit' : lit === false ? 'Unlit' : null,
    feeLine,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-1.5">
      {placeLine && (
        <div className="space-y-1">
          <p className="flex items-start gap-1 text-[11px] text-[rgba(26,26,26,0.45)]">
            <MapPin size={11} className="mt-0.5 flex-shrink-0" />
            <span>{placeLine}</span>
          </p>
          {mapsHref && (
            <a
              href={mapsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex text-[10px] tracking-[0.14em] uppercase font-medium text-[#1a1a1a] underline underline-offset-2"
            >
              Open in Maps
            </a>
          )}
        </div>
      )}
      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {facts.map((fact) => (
            <span key={fact} className="rounded-full text-[9px] tracking-[0.12em] uppercase text-[#1a1a1a] bg-brand-field px-2.5 py-0.5">
              {fact}
            </span>
          ))}
        </div>
      )}
      {bio && (
        <div className="pt-1">
          <ExpandableText text={bio} className="font-copy text-sm text-[#497250] leading-snug" />
        </div>
      )}
      {openingHours?.trim() && (
        <div className="pt-1">
          <OpeningHours hours={openingHours} />
        </div>
      )}
      {((showPhone && phone) || websiteHref) && (
        <div className="pt-1 space-y-1">
          {showPhone && phone && (
            <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-sm text-[rgba(26,26,26,0.65)]">
              <Phone size={12} /> {phone}
            </a>
          )}
          {websiteHref && (
            <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[rgba(26,26,26,0.65)] underline underline-offset-2">
              <Globe size={12} /> {website}
            </a>
          )}
        </div>
      )}
      {(whatsapp || instagram || telegram || facebook) && (
        <div className="flex flex-wrap gap-2 pt-2">
          {whatsapp ? <SocialChip href={whatsappHref(whatsapp)} label="WA" /> : null}
          {instagram ? <SocialChip href={instagramHref(instagram)} label="IG" /> : null}
          {telegram ? <SocialChip href={telegramHref(telegram)} label="TG" /> : null}
          {facebook ? <SocialChip href={facebookHref(facebook)} label="FB" /> : null}
        </div>
      )}
    </div>
  )
}
