'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CityLocationField } from '@/components/location/CityLocationField'
import type { CityCoords } from '@/components/ui/CityInput'
import { SquarePhotoCrop, type SquarePhotoCropHandle } from '@/app/(app)/feed/SquarePhotoCrop'
import { OpeningHoursEditor } from '@/components/court/OpeningHoursEditor'

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm'

const SURFACE_OPTIONS = [
  { value: 'hard', label: 'Hard' },
  { value: 'clay', label: 'Clay' },
  { value: 'grass', label: 'Grass' },
  { value: 'carpet', label: 'Carpet' },
  { value: 'synthetic', label: 'Synthetic' },
] as const

const VALID_SURFACES = new Set(SURFACE_OPTIONS.map((o) => o.value))

function sanitizeSurfaces(values: string[]): Array<(typeof SURFACE_OPTIONS)[number]['value']> {
  return values.filter((v): v is (typeof SURFACE_OPTIONS)[number]['value'] => VALID_SURFACES.has(v as (typeof SURFACE_OPTIONS)[number]['value']))
}

export interface CourtDetailsValues {
  name: string
  username: string
  city: string
  cityLat: number | null
  cityLng: number | null
  address: string
  phone: string
  website: string
  openingHours: string
  description: string
  avatarUrl?: string | null
  courtCount: string
  surfaces: string[]
  hasIndoor: boolean | null
  hasOutdoor: boolean | null
  lit: boolean | null
  feeHourMin: string
  feeHourMax: string
  whatsapp: string
  instagram: string
  telegram: string
  facebook: string
}

export function emptyCourtDetails(): CourtDetailsValues {
  return {
    name: '',
    username: '',
    city: '',
    cityLat: null,
    cityLng: null,
    address: '',
    phone: '',
    website: '',
    openingHours: '',
    description: '',
    avatarUrl: null,
    courtCount: '',
    surfaces: [],
    hasIndoor: null,
    hasOutdoor: null,
    lit: null,
    feeHourMin: '',
    feeHourMax: '',
    whatsapp: '',
    instagram: '',
    telegram: '',
    facebook: '',
  }
}

function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : null
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number.parseInt(trimmed, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function cleanHandle(raw: string): string | null {
  let trimmed = raw.trim()
  if (!trimmed) return null
  trimmed = trimmed
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '')
    .replace(/^@+/, '')
    .replace(/\/$/, '')
  return trimmed || null
}

async function uniqueCourtUsername(name: string, selfId: string): Promise<string> {
  const supabase = createClient()
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'court'
  for (let n = 0; n < 50; n += 1) {
    const suffix = n === 0 ? '' : String(n)
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}` || 'court'
    const { data } = await supabase.from('profiles').select('id').eq('username', candidate).maybeSingle()
    if (!data || data.id === selfId) return candidate
  }
  return `${base.slice(0, 12)}${Date.now().toString().slice(-6)}`
}

export function courtDetailsComplete(values: Pick<CourtDetailsValues, 'name' | 'city' | 'address' | 'phone'>): boolean {
  return Boolean(
    values.name.trim()
    && values.city.trim()
    && values.address.trim()
    && values.phone.trim(),
  )
}

export async function saveCourtDetails(values: CourtDetailsValues, avatar?: Blob | null): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Sign in to save these details.'

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, account_kind')
    .eq('id', user.id)
    .single()
  if (profile?.account_kind !== 'court') return 'This account is not a court.'

  if (!courtDetailsComplete(values)) {
    return 'Name, city, address, and phone are required.'
  }

  const currentUsername = profile.username ?? ''
  const chosen = values.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
  let username = currentUsername
  if (chosen.length >= 3) {
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', chosen)
      .neq('id', user.id)
      .maybeSingle()
    if (taken) return 'That username is already taken.'
    username = chosen
  } else if (/^court\d*$/.test(currentUsername)) {
    username = await uniqueCourtUsername(values.name, user.id)
  }

  let avatarUrl: string | undefined
  if (avatar) {
    const path = `${user.id}/avatar.jpg`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, avatar, {
      upsert: true,
      contentType: 'image/jpeg',
    })
    if (uploadError) return uploadError.message
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    avatarUrl = `${publicUrl}?v=${Date.now()}`
  }

  const feeMin = parseOptionalNumber(values.feeHourMin)
  const feeMax = parseOptionalNumber(values.feeHourMax)
  if (feeMin != null && feeMax != null && feeMax < feeMin) {
    return 'Hourly fee “to” should be at least the “from” amount.'
  }

  const { error } = await supabase.from('profiles').update({
    full_name: values.name.trim(),
    username,
    city_name: values.city.trim(),
    city_lat: values.cityLat,
    city_lng: values.cityLng,
    address: values.address.trim(),
    phone: values.phone.trim(),
    website: values.website.trim() || null,
    opening_hours: values.openingHours.trim() || null,
    bio: values.description.trim() || null,
    court_count: parseOptionalInt(values.courtCount),
    preferred_surfaces: sanitizeSurfaces(values.surfaces),
    has_indoor: values.hasIndoor,
    has_outdoor: values.hasOutdoor,
    lit: values.lit,
    fee_hour_min: feeMin,
    fee_hour_max: feeMax,
    whatsapp: cleanHandle(values.whatsapp),
    instagram: cleanHandle(values.instagram),
    telegram: cleanHandle(values.telegram),
    facebook: values.facebook.trim() || null,
    ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
  }).eq('id', user.id)

  return error ? error.message : null
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${
        active
          ? 'rounded-full bg-[#E8748A] text-[#1a1a1a] border-[#E8748A]'
          : 'rounded-full bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
      }`}
    >
      {children}
    </button>
  )
}

export function CourtDetailsForm({
  initial,
  submitLabel,
  onSaved,
  allowPhoto = true,
  footer = null,
  onDirtyChange,
  formId = 'court-details-form',
  hideSubmit = false,
  onSavingChange,
}: {
  initial?: Partial<CourtDetailsValues>
  submitLabel: string
  onSaved?: () => void
  allowPhoto?: boolean
  footer?: React.ReactNode
  onDirtyChange?: (dirty: boolean) => void
  formId?: string
  hideSubmit?: boolean
  onSavingChange?: (saving: boolean) => void
}) {
  const seed = { ...emptyCourtDetails(), ...initial }
  const [name, setName] = useState(seed.name)
  const [city, setCity] = useState(seed.city)
  const [coords, setCoords] = useState<CityCoords | null>(
    seed.cityLat != null && seed.cityLng != null
      ? { lat: seed.cityLat, lng: seed.cityLng }
      : null,
  )
  const [address, setAddress] = useState(seed.address)
  const [phone, setPhone] = useState(seed.phone)
  const [website, setWebsite] = useState(seed.website)
  const [openingHours, setOpeningHours] = useState(seed.openingHours)
  const [description, setDescription] = useState(seed.description)
  const [courtCount, setCourtCount] = useState(seed.courtCount)
  const [surfaces, setSurfaces] = useState<string[]>(sanitizeSurfaces(seed.surfaces))
  const [hasIndoor, setHasIndoor] = useState<boolean | null>(seed.hasIndoor)
  const [hasOutdoor, setHasOutdoor] = useState<boolean | null>(seed.hasOutdoor)
  const [lit, setLit] = useState<boolean | null>(seed.lit)
  const [feeHourMin, setFeeHourMin] = useState(seed.feeHourMin)
  const [feeHourMax, setFeeHourMax] = useState(seed.feeHourMax)
  const [whatsapp, setWhatsapp] = useState(seed.whatsapp)
  const [instagram, setInstagram] = useState(seed.instagram)
  const [telegram, setTelegram] = useState(seed.telegram)
  const [facebook, setFacebook] = useState(seed.facebook)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [pendingAvatar, setPendingAvatar] = useState<Blob | null>(null)
  const [avatarPreview, setAvatarPreview] = useState(seed.avatarUrl ?? null)
  const [cropping, setCropping] = useState(false)
  const cropRef = useRef<SquarePhotoCropHandle>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dirtyRef = useRef(false)

  function markDirty() {
    if (dirtyRef.current) return
    dirtyRef.current = true
    onDirtyChange?.(true)
  }

  useEffect(() => {
    onDirtyChange?.(false)
    dirtyRef.current = false
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function applyCrop() {
    setCropping(true)
    setError(null)
    try {
      const square = await cropRef.current?.exportSquare()
      if (!square) throw new Error('Could not prepare the photo. Try again.')
      setPendingAvatar(square)
      setAvatarPreview(URL.createObjectURL(square))
      setAvatarFile(null)
      markDirty()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not prepare the photo. Try again.')
    } finally {
      setCropping(false)
    }
  }

  const values: CourtDetailsValues = {
    name,
    username: seed.username,
    city,
    cityLat: coords?.lat ?? seed.cityLat ?? null,
    cityLng: coords?.lng ?? seed.cityLng ?? null,
    address,
    phone,
    website,
    openingHours,
    description,
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
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!courtDetailsComplete(values) || loading) return
    setLoading(true)
    onSavingChange?.(true)
    setError(null)
    const message = await saveCourtDetails(values, pendingAvatar)
    setLoading(false)
    onSavingChange?.(false)
    if (message) {
      setError(message)
      return
    }
    dirtyRef.current = false
    onDirtyChange?.(false)
    onSaved?.()
  }

  if (allowPhoto && avatarFile) {
    return (
      <div className="space-y-4">
        <SquarePhotoCrop ref={cropRef} file={avatarFile} shape="circle" outputSize={512} quality={0.8} onRemove={() => setAvatarFile(null)} />
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded text-sm text-red-600">{error}</div>
        )}
        <button
          type="button"
          onClick={() => void applyCrop()}
          disabled={cropping}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 transition-colors"
        >
          {cropping ? 'Preparing...' : 'Use this photo'}
        </button>
      </div>
    )
  }

  const photo = avatarPreview
  const photoInitials = (name || seed.name || 'Court').split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
  const canSave = courtDetailsComplete(values)

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-4">
      {allowPhoto && (
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center flex-shrink-0">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-2xl text-[#1a1a1a]">{photoInitials}</span>
            )}
          </div>
          <label className="text-[11px] tracking-[0.14em] uppercase font-medium text-[#1a1a1a] underline underline-offset-2 cursor-pointer">
            {photo ? 'Change photo' : 'Add photo'}
            <span className="ml-2 normal-case tracking-normal text-[rgba(26,26,26,0.35)] no-underline">optional</span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                if (file) {
                  setAvatarFile(file)
                  markDirty()
                }
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Court name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); markDirty() }}
          placeholder="Tennis Center"
          required
          maxLength={80}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">City</label>
        <CityLocationField
          value={city}
          onChange={(next, nextCoords) => {
            setCity(next)
            setCoords(nextCoords ?? null)
            markDirty()
          }}
          helper="Your court home city — used when players find you."
          placeholder="Austin"
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Address</label>
        <input
          type="text"
          value={address}
          onChange={(e) => { setAddress(e.target.value); markDirty() }}
          placeholder="Street, building, area"
          required
          maxLength={200}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); markDirty() }}
          placeholder="(512) 000-0000"
          required
          maxLength={40}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">
          Website <span className="normal-case tracking-normal text-[rgba(26,26,26,0.35)]">optional</span>
        </label>
        <input
          type="text"
          value={website}
          onChange={(e) => { setWebsite(e.target.value); markDirty() }}
          placeholder="https://"
          maxLength={300}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">
          Opening hours <span className="normal-case tracking-normal text-[rgba(26,26,26,0.35)]">optional</span>
        </label>
        <OpeningHoursEditor
          value={openingHours}
          onChange={(next) => { setOpeningHours(next); markDirty() }}
        />
      </div>

      <div className="pt-2 space-y-3">
        <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">Facility · optional</p>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Number of courts</label>
          <input
            type="number"
            min={1}
            inputMode="numeric"
            value={courtCount}
            onChange={(e) => { setCourtCount(e.target.value); markDirty() }}
            placeholder="4"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Surface</label>
          <div className="flex flex-wrap gap-2">
            {SURFACE_OPTIONS.map((option) => (
              <Pill
                key={option.value}
                active={surfaces.includes(option.value)}
                onClick={() => {
                  setSurfaces((prev) => (
                    prev.includes(option.value)
                      ? prev.filter((value) => value !== option.value)
                      : [...prev, option.value]
                  ))
                  markDirty()
                }}
              >
                {option.label}
              </Pill>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">
            Indoor / outdoor <span className="normal-case tracking-normal text-[rgba(26,26,26,0.35)]">optional</span>
          </label>
          <p className="text-[11px] text-[rgba(26,26,26,0.45)] mb-2">Select both if you have both.</p>
          <div className="flex flex-wrap gap-2">
            <Pill
              active={hasIndoor === true}
              onClick={() => { setHasIndoor(hasIndoor === true ? null : true); markDirty() }}
            >
              Indoor
            </Pill>
            <Pill
              active={hasOutdoor === true}
              onClick={() => { setHasOutdoor(hasOutdoor === true ? null : true); markDirty() }}
            >
              Outdoor
            </Pill>
          </div>
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">
            Evening lights <span className="normal-case tracking-normal text-[rgba(26,26,26,0.35)]">optional</span>
          </label>
          <p className="text-[11px] text-[rgba(26,26,26,0.45)] mb-2">Do the courts have lighting for night play?</p>
          <div className="flex flex-wrap gap-2">
            <Pill active={lit === true} onClick={() => { setLit(lit === true ? null : true); markDirty() }}>Yes</Pill>
            <Pill active={lit === false} onClick={() => { setLit(lit === false ? null : false); markDirty() }}>No</Pill>
          </div>
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Hourly fee range</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              inputMode="decimal"
              value={feeHourMin}
              onChange={(e) => { setFeeHourMin(e.target.value); markDirty() }}
              placeholder="From"
              className={inputClass}
            />
            <input
              type="text"
              inputMode="decimal"
              value={feeHourMax}
              onChange={(e) => { setFeeHourMax(e.target.value); markDirty() }}
              placeholder="To"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div className="pt-2 space-y-3">
        <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">Social · optional</p>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">WhatsApp</label>
          <input type="text" value={whatsapp} onChange={(e) => { setWhatsapp(e.target.value); markDirty() }} placeholder="+1…" maxLength={40} className={inputClass} />
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Instagram</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.55)] text-sm">@</span>
            <input
              type="text"
              value={instagram}
              onChange={(e) => { setInstagram(e.target.value.replace(/^@+/, '')); markDirty() }}
              placeholder="yourcourt"
              maxLength={60}
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Telegram</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.55)] text-sm">@</span>
            <input
              type="text"
              value={telegram}
              onChange={(e) => { setTelegram(e.target.value.replace(/^@+/, '')); markDirty() }}
              placeholder="yourcourt"
              maxLength={60}
              className={`${inputClass} pl-8`}
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Facebook</label>
          <input type="text" value={facebook} onChange={(e) => { setFacebook(e.target.value); markDirty() }} placeholder="Page URL or name" maxLength={200} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">
          Short description <span className="normal-case tracking-normal text-[rgba(26,26,26,0.35)]">optional</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => { setDescription(e.target.value); markDirty() }}
          placeholder="Any information that may be useful for players."
          maxLength={600}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
      {footer}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded text-sm text-red-600">{error}</div>
      )}
      {!hideSubmit && (
        <button
          type="submit"
          disabled={loading || !canSave}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Saving...' : submitLabel}
        </button>
      )}
    </form>
  )
}

export function CourtDetailsContinue() {
  const router = useRouter()
  return (
    <CourtDetailsForm
      submitLabel="Save and continue"
      allowPhoto
      onSaved={() => router.refresh()}
    />
  )
}
