import { ArrowUpRight, Globe, MapPin, Phone } from 'lucide-react'
import { OpeningHours } from '@/components/court/OpeningHours'
import { ExpandableText } from '@/components/ui/ExpandableText'

const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  carpet: 'Carpet',
  synthetic: 'Synthetic',
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

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-brand-field border border-[#1a1a1a]/12 text-[#1a1a1a] hover:bg-white transition-colors"
    >
      {children}
    </a>
  )
}

function WhatsAppGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function InstagramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  )
}

function TelegramGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  )
}

function FacebookGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  )
}

type FactChip = {
  key: string
  label: string
  tone: 'count' | 'fee' | 'feature'
}

/** Same pill chrome for every fact; only the fill/text tint changes. */
const CHIP_BASE =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]'

const CHIP_TONE: Record<FactChip['tone'], string> = {
  count: 'bg-[#D7EBE6] text-[#1F5C50]',
  fee: 'bg-[#F6D9DF] text-[#7A2F3F]',
  feature: 'bg-brand-field text-[#1a1a1a]',
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
  hasIndoor,
  hasOutdoor,
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
  hasIndoor?: boolean | null
  hasOutdoor?: boolean | null
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
  const surfaceLabels = (surfaces ?? [])
    .map((s) => SURFACE_LABELS[s])
    .filter(Boolean) as string[]
  const settingLabels = [
    hasIndoor ? 'Indoor' : null,
    hasOutdoor ? 'Outdoor' : null,
  ].filter(Boolean) as string[]
  const feeLine = (() => {
    if (feeHourMin == null && feeHourMax == null) return null
    if (feeHourMin != null && feeHourMax != null) {
      if (feeHourMin === feeHourMax) return `${feeHourMin}/hr`
      return `${feeHourMin}–${feeHourMax}/hr`
    }
    if (feeHourMin != null) return `from ${feeHourMin}/hr`
    return `up to ${feeHourMax}/hr`
  })()

  const chips: FactChip[] = []
  if (courtCount != null) {
    chips.push({
      key: 'count',
      label: `${courtCount} court${courtCount === 1 ? '' : 's'}`,
      tone: 'count',
    })
  }
  if (surfaceLabels.length) {
    chips.push({ key: 'surfaces', label: surfaceLabels.join(' · '), tone: 'feature' })
  }
  if (settingLabels.length) {
    chips.push({ key: 'setting', label: settingLabels.join(' · '), tone: 'feature' })
  }
  if (lit === true) chips.push({ key: 'lit', label: 'Lit', tone: 'feature' })
  if (lit === false) chips.push({ key: 'unlit', label: 'Unlit', tone: 'feature' })
  if (feeLine) chips.push({ key: 'fee', label: feeLine, tone: 'fee' })

  const hasSocials = Boolean(websiteHref || whatsapp || instagram || telegram || facebook)

  return (
    <div className="space-y-1.5">
      {placeLine && (
        mapsHref ? (
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-1.5 text-[13px] font-medium text-[#1a1a1a] hover:opacity-75 transition-opacity"
          >
            <MapPin size={13} className="mt-0.5 flex-shrink-0 text-[#1a1a1a]" />
            <span className="underline-offset-2 group-hover:underline">{placeLine}</span>
            <ArrowUpRight size={13} className="mt-0.5 flex-shrink-0 text-[rgba(26,26,26,0.45)]" aria-hidden />
          </a>
        ) : (
          <p className="flex items-start gap-1.5 text-[13px] font-medium text-[#1a1a1a]">
            <MapPin size={13} className="mt-0.5 flex-shrink-0" />
            <span>{placeLine}</span>
          </p>
        )
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {chips.map((chip) => (
            <span key={chip.key} className={`${CHIP_BASE} ${CHIP_TONE[chip.tone]}`}>
              {chip.label}
            </span>
          ))}
        </div>
      )}
      {bio && (
        <div className="pt-1">
          <ExpandableText text={bio} lines={3} className="font-copy text-sm text-[#497250] leading-snug" />
        </div>
      )}
      {openingHours?.trim() && (
        <div className="pt-1">
          <OpeningHours hours={openingHours} />
        </div>
      )}
      {showPhone && phone && (
        <div className="pt-1">
          <a href={`tel:${phone}`} className="flex items-center gap-1.5 text-sm text-[rgba(26,26,26,0.65)]">
            <Phone size={12} /> {phone}
          </a>
        </div>
      )}
      {hasSocials && (
        <div className="flex flex-wrap gap-2 pt-2">
          {websiteHref ? (
            <SocialIcon href={websiteHref} label="Website">
              <Globe size={15} strokeWidth={1.75} />
            </SocialIcon>
          ) : null}
          {whatsapp ? (
            <SocialIcon href={whatsappHref(whatsapp)} label="WhatsApp">
              <WhatsAppGlyph />
            </SocialIcon>
          ) : null}
          {instagram ? (
            <SocialIcon href={instagramHref(instagram)} label="Instagram">
              <InstagramGlyph />
            </SocialIcon>
          ) : null}
          {telegram ? (
            <SocialIcon href={telegramHref(telegram)} label="Telegram">
              <TelegramGlyph />
            </SocialIcon>
          ) : null}
          {facebook ? (
            <SocialIcon href={facebookHref(facebook)} label="Facebook">
              <FacebookGlyph />
            </SocialIcon>
          ) : null}
        </div>
      )}
    </div>
  )
}
