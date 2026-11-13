'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Check, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CityLocationField } from '@/components/location/CityLocationField'
import { SquarePhotoCrop, type SquarePhotoCropHandle } from '@/app/(app)/feed/SquarePhotoCrop'
import {
  courtDetailsComplete,
  emptyCourtDetails,
  saveCourtDetails,
  type CourtDetailsValues,
} from '@/components/court/CourtDetailsForm'
import { OpeningHoursEditor } from '@/components/court/OpeningHoursEditor'

const TOTAL_STEPS = 3
const inputClass = 'w-full px-4 py-3 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm'

const SURFACE_OPTIONS = [
  { value: 'hard', label: 'Hard' },
  { value: 'clay', label: 'Clay' },
  { value: 'grass', label: 'Grass' },
  { value: 'indoor', label: 'Indoor' },
]

function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-5xl tracking-wide leading-none text-[#1a1a1a] mb-2">{title}</h2>
      <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">{sub}</p>
    </div>
  )
}

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-2">
      {children}
      {optional ? <span className="ml-2 normal-case tracking-normal text-[rgba(26,26,26,0.3)]">optional</span> : null}
    </p>
  )
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
      className={`px-4 py-2 text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${
        active
          ? 'rounded-full bg-[#E8748A] text-[#1a1a1a] border-[#E8748A]'
          : 'rounded-full bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
      }`}
    >
      {children}
    </button>
  )
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'

export default function CourtOnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [data, setData] = useState<CourtDetailsValues>(emptyCourtDetails())
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [pendingAvatar, setPendingAvatar] = useState<Blob | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const cropRef = useRef<SquarePhotoCropHandle>(null)
  const [cropping, setCropping] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/sign-in')
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_kind, username, full_name, city_name, city_lat, city_lng, address, phone, website, opening_hours, bio, avatar_url, court_count, preferred_surfaces, lit, fee_hour_min, fee_hour_max, whatsapp, instagram, telegram, facebook')
        .eq('id', session.user.id)
        .single()
      if (cancelled) return
      if (!profile || profile.account_kind !== 'court') {
        router.replace('/onboarding')
        return
      }
      const autoUsername = /^court\d*$/.test(profile.username || '')
      const seeded: CourtDetailsValues = {
        ...emptyCourtDetails(),
        name: profile.full_name || '',
        username: autoUsername ? '' : (profile.username || ''),
        city: profile.city_name || '',
        cityLat: profile.city_lat ?? null,
        cityLng: profile.city_lng ?? null,
        address: profile.address || '',
        phone: profile.phone || '',
        website: profile.website || '',
        openingHours: profile.opening_hours || '',
        description: profile.bio || '',
        avatarUrl: profile.avatar_url,
        courtCount: profile.court_count != null ? String(profile.court_count) : '',
        surfaces: profile.preferred_surfaces ?? [],
        lit: profile.lit ?? null,
        feeHourMin: profile.fee_hour_min != null ? String(profile.fee_hour_min) : '',
        feeHourMax: profile.fee_hour_max != null ? String(profile.fee_hour_max) : '',
        whatsapp: profile.whatsapp || '',
        instagram: profile.instagram || '',
        telegram: profile.telegram || '',
        facebook: profile.facebook || '',
      }
      if (courtDetailsComplete(seeded) && !autoUsername && (profile.username || '').length >= 3) {
        router.replace('/me')
        return
      }
      setUserId(session.user.id)
      setData(seeded)
      setAvatarPreview(profile.avatar_url)
      setLoading(false)
    }
    void boot()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    if (!userId) return
    const username = data.username.trim()
    if (username.length < 3) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', userId)
        .maybeSingle()
      setUsernameStatus(existing ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [data.username, userId])

  function update(partial: Partial<CourtDetailsValues>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  function canProceed() {
    if (step === 1) {
      return Boolean(
        data.name.trim()
        && data.city.trim()
        && data.address.trim()
        && data.username.trim().length >= 3
        && usernameStatus === 'available',
      )
    }
    if (step === 2) {
      return Boolean(data.phone.trim())
    }
    return true
  }

  async function applyCrop() {
    setCropping(true)
    setError(null)
    try {
      const square = await cropRef.current?.exportSquare()
      if (!square) throw new Error('Could not prepare the photo. Try again.')
      setPendingAvatar(square)
      setAvatarPreview(URL.createObjectURL(square))
      setAvatarFile(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not prepare the photo. Try again.')
    } finally {
      setCropping(false)
    }
  }

  async function finish() {
    if (saving) return
    setSaving(true)
    setError(null)
    const message = await saveCourtDetails(data, pendingAvatar)
    setSaving(false)
    if (message) {
      setError(message)
      return
    }
    window.location.assign('/me')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <Loader2 size={22} className="animate-spin text-[rgba(26,26,26,0.35)]" />
      </div>
    )
  }

  if (avatarFile) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="page-header">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button type="button" onClick={() => setAvatarFile(null)} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center">
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.5)]" />
            </button>
            <span className="font-display text-3xl tracking-wide flex-1">PHOTO</span>
            <button
              type="button"
              onClick={() => void applyCrop()}
              disabled={cropping}
              className="px-4 py-1.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium disabled:opacity-40"
            >
              {cropping ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <SquarePhotoCrop ref={cropRef} file={avatarFile} shape="circle" outputSize={512} quality={0.8} onRemove={() => setAvatarFile(null)} />
          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((prev) => Math.max(1, prev - 1))}
              className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center"
            >
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.5)]" />
            </button>
          ) : (
            <div className="w-9" />
          )}
          <span className="font-display text-3xl tracking-wide flex-1">COURT SETUP</span>
          <span className="text-[10px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">{step}/{TOTAL_STEPS}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="mb-6 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <div
              key={index}
              className={`h-1 flex-1 rounded-full ${index < step ? 'bg-[#E8748A]' : 'bg-[#1a1a1a]/10'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <StepHeading title="ABOUT THE COURT" sub="Players see this on your profile and in Search in the app" />
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center flex-shrink-0 border border-[#1a1a1a]/15"
                >
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={20} className="text-[rgba(26,26,26,0.45)]" />
                  )}
                </button>
                <div>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] tracking-[0.15em] uppercase font-medium text-brand-primary">
                    {avatarPreview ? 'Change photo' : 'Add photo'}
                  </button>
                  <p className="text-[9px] text-[rgba(26,26,26,0.35)] mt-0.5">Optional</p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    if (file) setAvatarFile(file)
                    e.target.value = ''
                  }}
                />
              </div>
              <div>
                <FieldLabel>Court name</FieldLabel>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) => update({ name: e.target.value })}
                  placeholder="Tennis Center"
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Username</FieldLabel>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.55)] text-sm">@</span>
                  <input
                    type="text"
                    value={data.username}
                    onChange={(e) => update({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    placeholder="your_court"
                    maxLength={20}
                    className={`${inputClass} pl-8 pr-10`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameStatus === 'checking' && <Loader2 size={14} className="animate-spin text-[rgba(26,26,26,0.3)]" />}
                    {usernameStatus === 'available' && <Check size={14} className="text-brand-primary" />}
                    {usernameStatus === 'taken' && <X size={14} className="text-red-500" />}
                  </div>
                </div>
                <div className="mt-1.5 flex justify-between">
                  <p className="text-[9px] text-[rgba(26,26,26,0.35)]">Letters, numbers and underscores only</p>
                  {usernameStatus === 'taken' && <p className="text-[9px] text-red-500">Username is taken</p>}
                  {usernameStatus === 'available' && <p className="text-[9px] text-brand-primary">Available</p>}
                </div>
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <CityLocationField
                  value={data.city}
                  onChange={(city, coords) => update({
                    city,
                    cityLat: coords?.lat ?? null,
                    cityLng: coords?.lng ?? null,
                  })}
                  helper="Home city for this court — not a temporary browse location."
                  placeholder="Austin"
                />
              </div>
              <div>
                <FieldLabel>Address</FieldLabel>
                <input
                  type="text"
                  value={data.address}
                  onChange={(e) => update({ address: e.target.value })}
                  placeholder="Street, building, area"
                  maxLength={200}
                  className={inputClass}
                />
              </div>
              <p className="font-copy text-[12px] leading-snug text-[rgba(26,26,26,0.55)]">
                You can edit every detail later.
              </p>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepHeading title="HOW TO REACH YOU" sub="Phone is required · hours and website are optional" />
            <div className="space-y-5">
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input type="tel" value={data.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="(512) 000-0000" maxLength={40} className={inputClass} />
              </div>
              <div>
                <FieldLabel optional>Opening hours</FieldLabel>
                <OpeningHoursEditor
                  value={data.openingHours}
                  onChange={(openingHours) => update({ openingHours })}
                />
              </div>
              <div>
                <FieldLabel optional>Website</FieldLabel>
                <input type="text" value={data.website} onChange={(e) => update({ website: e.target.value })} placeholder="https://" maxLength={300} className={inputClass} />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <StepHeading title="EXTRA DETAILS" sub="All optional — you can edit everything later" />
            <div className="space-y-5">
              <div>
                <FieldLabel optional>Number of courts</FieldLabel>
                <input type="number" min={1} inputMode="numeric" value={data.courtCount} onChange={(e) => update({ courtCount: e.target.value })} placeholder="4" className={inputClass} />
              </div>
              <div>
                <FieldLabel optional>Surface</FieldLabel>
                <div className="flex flex-wrap gap-2.5">
                  {SURFACE_OPTIONS.map((option) => (
                    <Pill
                      key={option.value}
                      active={data.surfaces.includes(option.value)}
                      onClick={() => update({
                        surfaces: data.surfaces.includes(option.value)
                          ? data.surfaces.filter((value) => value !== option.value)
                          : [...data.surfaces, option.value],
                      })}
                    >
                      {option.label}
                    </Pill>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel optional>Lighting</FieldLabel>
                <div className="flex flex-wrap gap-2.5">
                  <Pill active={data.lit === true} onClick={() => update({ lit: true })}>Lit</Pill>
                  <Pill active={data.lit === false} onClick={() => update({ lit: false })}>Unlit</Pill>
                  <Pill active={data.lit === null} onClick={() => update({ lit: null })}>Skip</Pill>
                </div>
              </div>
              <div>
                <FieldLabel optional>Hourly fee range</FieldLabel>
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" inputMode="decimal" value={data.feeHourMin} onChange={(e) => update({ feeHourMin: e.target.value })} placeholder="From" className={inputClass} />
                  <input type="text" inputMode="decimal" value={data.feeHourMax} onChange={(e) => update({ feeHourMax: e.target.value })} placeholder="To" className={inputClass} />
                </div>
              </div>
              <div>
                <FieldLabel optional>WhatsApp</FieldLabel>
                <input type="text" value={data.whatsapp} onChange={(e) => update({ whatsapp: e.target.value })} placeholder="+1…" maxLength={40} className={inputClass} />
              </div>
              <div>
                <FieldLabel optional>Instagram</FieldLabel>
                <input type="text" value={data.instagram} onChange={(e) => update({ instagram: e.target.value })} placeholder="handle" maxLength={60} className={inputClass} />
              </div>
              <div>
                <FieldLabel optional>Telegram</FieldLabel>
                <input type="text" value={data.telegram} onChange={(e) => update({ telegram: e.target.value })} placeholder="handle" maxLength={60} className={inputClass} />
              </div>
              <div>
                <FieldLabel optional>Facebook</FieldLabel>
                <input type="text" value={data.facebook} onChange={(e) => update({ facebook: e.target.value })} placeholder="Page URL or name" maxLength={200} className={inputClass} />
              </div>
              <div>
                <FieldLabel optional>Short description</FieldLabel>
                <textarea
                  value={data.description}
                  onChange={(e) => update({ description: e.target.value })}
                  placeholder="Any information that may be useful for players."
                  maxLength={600}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </div>
              <p className="font-copy text-[12px] text-[rgba(26,26,26,0.5)] leading-snug">
                You can change every field later from Settings → Edit profile.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 px-4 py-3 bg-red-50 border border-red-100 rounded text-sm text-red-600">{error}</div>
        )}

        <div className="mt-8">
          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={!canProceed()}
              onClick={() => setStep((prev) => prev + 1)}
              className="w-full py-3.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !courtDetailsComplete(data) || data.username.trim().length < 3}
              onClick={() => void finish()}
              className="w-full py-3.5 rounded-full bg-[#3A8A7A] text-white text-[10px] tracking-[0.2em] uppercase font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Saving...' : 'Finish'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
