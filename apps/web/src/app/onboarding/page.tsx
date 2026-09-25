'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Check, Loader2, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CityInput } from '@/components/ui/CityInput'
import { AvailabilityEditor } from '@/components/ui/AvailabilityEditor'
import { legacySchedule, storedAvailability, type Availability } from '@/lib/availability'
import { SquarePhotoCrop, type SquarePhotoCropHandle } from '@/app/(app)/feed/SquarePhotoCrop'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OnboardingData {
  city: string
  cityLat: number | null
  cityLng: number | null
  yearsPlaying: number | null
  skillLevel: number | null
  playFormats: string[]
  playStyle: string | null
  preferredSurfaces: string[]
  availability: Availability
  bio: string
  lookingFor: string
  username: string
  avatarFile: File | null
  presetAvatar: string
}

const PRESET_AVATARS = [
  '/avatars/preset-1.jpg',
  '/avatars/preset-4.jpg',
  '/avatars/preset-7.jpg',
  '/avatars/preset-8.jpg',
]

const INITIAL_DATA: OnboardingData = {
  city: '', cityLat: null, cityLng: null, yearsPlaying: null, skillLevel: null,
  playFormats: [], playStyle: null, preferredSurfaces: [], availability: {},
  bio: '', lookingFor: '', username: '', avatarFile: null,
  presetAvatar: '/avatars/preset-4.jpg',
}

const TOTAL_STEPS = 5

// ─── Shared UI ────────────────────────────────────────────────────────────────

function StepHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-8">
      <h2 className="font-display text-5xl tracking-wide leading-none text-[#1a1a1a] mb-2">{title}</h2>
      <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">{sub}</p>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-2">{children}</p>
  )
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

// ─── Step 1: Location ─────────────────────────────────────────────────────────

type GeoDetectState = 'idle' | 'detecting' | 'detected' | 'error'

function Step1({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  const [geoState, setGeoState] = useState<GeoDetectState>('idle')
  const [detectedCity, setDetectedCity] = useState<string | null>(null)

  async function handleUseMyLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoState('error')
      return
    }
    setGeoState('detecting')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
            { headers: { 'Accept-Language': 'en' } },
          )
          const result = await res.json() as { address?: { city?: string; town?: string; county?: string }; name?: string }
          const city = result.address?.city ?? result.address?.town ?? result.address?.county ?? result.name ?? null
          if (city) {
            setDetectedCity(city)
            setGeoState('detected')
          } else {
            setGeoState('error')
          }
        } catch {
          setGeoState('error')
        }
      },
      () => setGeoState('error'),
      { timeout: 10_000 },
    )
  }

  function confirmDetected() {
    if (detectedCity) onChange({ city: detectedCity })
    setGeoState('idle')
    setDetectedCity(null)
  }

  function rejectDetected() {
    setGeoState('idle')
    setDetectedCity(null)
  }

  return (
    <div>
      <StepHeading title="WHERE DO YOU PLAY?" sub="Helps us find players and courts near you" />
      <div className="space-y-4">
        <div>
          <FieldLabel>City</FieldLabel>

          {/* Detected city confirmation */}
          {geoState === 'detected' && detectedCity && (
            <div className="rounded-[20px] border border-[#3A8A7A]/30 bg-white px-4 py-3 mb-3">
              <p className="text-sm text-[#1a1a1a]">
                We detected your city as <span className="font-medium">{detectedCity}</span>. Is this correct?
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={confirmDetected}
                  className="flex-1 py-2 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-[#E8406A] transition-colors"
                >
                  Yes, that&apos;s right
                </button>
                <button
                  type="button"
                  onClick={rejectDetected}
                  className="flex-1 py-2 rounded-full bg-brand-field border border-[#1a1a1a]/40 text-[10px] tracking-[0.15em] uppercase font-medium text-[#1a1a1a] hover:border-[#1a1a1a]/60 transition-colors"
                >
                  Enter manually
                </button>
              </div>
            </div>
          )}

          <CityInput
            value={data.city}
            onChange={(city, coords) => onChange({ city, cityLat: coords?.lat ?? null, cityLng: coords?.lng ?? null })}
            placeholder="Search your city..."
          />

          {/* Use my location button */}
          {geoState !== 'detected' && (
            <button
              type="button"
              onClick={() => void handleUseMyLocation()}
              disabled={geoState === 'detecting'}
              className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-primary tracking-[0.1em] uppercase font-medium hover:underline disabled:opacity-40"
            >
              {geoState === 'detecting' ? (
                <><Loader2 size={11} className="animate-spin" /> Detecting location...</>
              ) : (
                <><MapPin size={11} /> Use my location</>
              )}
            </button>
          )}

          {geoState === 'error' && (
            <p className="mt-1.5 text-[11px] text-[rgba(26,26,26,0.45)]">
              Could not detect your location. Please enter your city manually.
            </p>
          )}

          <p className="mt-2 text-[11px] text-[rgba(26,26,26,0.35)]">
            Discover uses your city to show nearby players, games, and courts. You can change it later in your profile.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Tennis profile ───────────────────────────────────────────────────

const SKILL_LEVELS = [
  { value: 1.5, label: 'Beginner', sublabel: 'Just started or playing casually' },
  { value: 2.5, label: 'Intermediate', sublabel: 'Consistent rallies, learning strategy' },
  { value: 4.0, label: 'Advanced', sublabel: 'Competitive club player' },
  { value: 6.0, label: 'Competitive', sublabel: 'Ranked player, tournament regular' },
]

const YEARS_OPTIONS = [
  { value: 0.5, label: '< 1 year' },
  { value: 1.5, label: '1–2 years' },
  { value: 3.5, label: '2–5 years' },
  { value: 7.5, label: '5–10 years' },
  { value: 15, label: '10+ years' },
]

const FORMAT_OPTIONS = [
  { value: 'singles', label: 'Singles', sublabel: null },
  { value: 'doubles', label: 'Doubles', sublabel: '2v2, any gender' },
]

const STYLE_OPTIONS = [
  { value: 'recreational', label: 'Recreational', sublabel: 'Just for fun' },
  { value: 'competitive', label: 'Competitive', sublabel: 'I play to win' },
  { value: 'both', label: 'Both', sublabel: 'Depends on the match' },
]

function Step2({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  function toggleFormat(v: string) {
    const has = data.playFormats.includes(v)
    onChange({ playFormats: has ? data.playFormats.filter((f) => f !== v) : [...data.playFormats, v] })
  }

  return (
    <div>
      <StepHeading title="YOUR TENNIS" sub="Tell us about your game — all optional" />

      <div className="space-y-6">
        <div>
          <FieldLabel>How long have you been playing?</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {YEARS_OPTIONS.map((o) => (
              <Pill key={o.value} active={data.yearsPlaying === o.value} onClick={() => onChange({ yearsPlaying: o.value })}>
                {o.label}
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Your level</FieldLabel>
          <div className="grid grid-cols-2 gap-2">
            {SKILL_LEVELS.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => onChange({ skillLevel: s.value })}
                className={`flex flex-col p-3 border text-left transition-colors ${
                  data.skillLevel === s.value
                    ? 'rounded-[20px] border-[#E8748A] bg-[#E8748A]'
                    : 'rounded-[20px] bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
                }`}
              >
                <span className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[#1a1a1a]">
                  {s.label}
                </span>
                <span className={`text-[9px] mt-0.5 ${data.skillLevel === s.value ? 'text-[#1a1a1a]/80' : 'text-[rgba(26,26,26,0.55)]'}`}>{s.sublabel}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Preferred format</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((o) => (
              <Pill key={o.value} active={data.playFormats.includes(o.value)} onClick={() => toggleFormat(o.value)}>
                <span className="flex flex-col items-start">
                  <span>{o.label}</span>
                  {o.sublabel && <span className="text-[8px] normal-case tracking-normal opacity-60 mt-0.5">{o.sublabel}</span>}
                </span>
              </Pill>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>How do you like to play?</FieldLabel>
          <div className="grid grid-cols-3 gap-2">
            {STYLE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => onChange({ playStyle: o.value })}
                className={`flex flex-col p-3 border text-left transition-colors ${
                  data.playStyle === o.value
                    ? 'rounded-[20px] border-[#E8748A] bg-[#E8748A]'
                    : 'rounded-[20px] bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
                }`}
              >
                <span className="text-[10px] tracking-[0.1em] uppercase font-semibold text-[#1a1a1a]">
                  {o.label}
                </span>
                <span className={`text-[9px] mt-0.5 ${data.playStyle === o.value ? 'text-[#1a1a1a]/80' : 'text-[rgba(26,26,26,0.55)]'}`}>{o.sublabel}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Schedule ─────────────────────────────────────────────────────────

function Step3({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <StepHeading title="WHEN DO YOU PLAY?" sub="Help us match you with players on your schedule — all optional" />

      <div>
        <FieldLabel>When you play</FieldLabel>
        <AvailabilityEditor value={data.availability} onChange={(availability) => onChange({ availability })} />
      </div>
    </div>
  )
}

// ─── Step 4: About you ────────────────────────────────────────────────────────

function Step4({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div>
      <StepHeading title="ABOUT YOU" sub="Let other players know who you are — all optional" />

      <div className="space-y-5">
        <div>
          <FieldLabel>A few words about yourself</FieldLabel>
          <textarea
            value={data.bio}
            onChange={(e) => onChange({ bio: e.target.value })}
            placeholder="e.g. I love long baseline rallies and play a few times a week after work..."
            rows={3}
            maxLength={300}
            className="font-copy w-full px-4 py-3 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-[#1a1a1a] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all resize-none text-sm"
          />
          <p className="text-[9px] text-[rgba(26,26,26,0.3)] text-right mt-1">{data.bio.length}/300</p>
        </div>

        <div>
          <FieldLabel>Who are you looking for?</FieldLabel>
          <textarea
            value={data.lookingFor}
            onChange={(e) => onChange({ lookingFor: e.target.value })}
            placeholder="e.g. A partner around 3.0–3.5 for friendly matches 1–2x per week..."
            rows={3}
            maxLength={300}
            className="font-copy w-full px-4 py-3 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-[#1a1a1a] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all resize-none text-sm"
          />
          <p className="text-[9px] text-[rgba(26,26,26,0.3)] text-right mt-1">{data.lookingFor.length}/300</p>
        </div>

        <div className="rounded-lg bg-white px-4 py-3">
          <p className="text-[10px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.5)]">
            ✦ &nbsp; You can update your profile anytime from the Me section.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Step 5: Avatar + Username ────────────────────────────────────────────────

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'

function Step5({
  data, onChange, userId, cropRef,
}: {
  data: OnboardingData
  onChange: (d: Partial<OnboardingData>) => void
  userId: string
  cropRef: React.RefObject<SquarePhotoCropHandle | null>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    onChange({ avatarFile: file })
  }

  function clearPhoto() {
    if (fileInputRef.current) fileInputRef.current.value = ''
    onChange({ avatarFile: null })
  }

  function handlePresetSelect(preset: string) {
    clearPhoto()
    onChange({ avatarFile: null, presetAvatar: preset })
  }

  useEffect(() => {
    if (!userId) return
    const username = data.username.trim()
    if (username.length < 3) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data: existing } = await supabase
        .from('profiles').select('id')
        .eq('username', username).neq('id', userId).maybeSingle()
      setUsernameStatus(existing ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [data.username, userId])

  return (
    <div>
      <StepHeading title="YOUR PROFILE" sub="Choose a username to finish — photo is optional" />

      {/* Avatar */}
      <div className="mb-8">
        <div className="flex items-center gap-5 mb-4">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-brand-field border border-dashed border-[#1a1a1a]/25 hover:border-[#1a1a1a]/50 transition-colors flex items-center justify-center overflow-hidden group flex-shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.presetAvatar}
              alt="Avatar preview"
              className={`w-full h-full object-cover ${data.avatarFile ? 'opacity-40' : ''}`}
            />
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={18} className="text-white" />
            </div>
          </button>
          <div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] tracking-[0.15em] uppercase text-brand-primary font-medium hover:underline">
              {data.avatarFile ? 'Change photo' : 'Upload your photo'}
            </button>
            <p className="text-[9px] text-[rgba(26,26,26,0.35)] mt-0.5">Optional — or pick a preset below</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </div>

        {/* Preset avatars */}
        <div className="flex gap-3">
          {PRESET_AVATARS.map((src) => {
            const isSelected = !data.avatarFile && data.presetAvatar === src
            return (
              <button
                key={src}
                type="button"
                onClick={() => handlePresetSelect(src)}
                className={`w-14 h-14 rounded-full overflow-hidden border-2 transition-all flex-shrink-0 ${
                  isSelected ? 'border-[#E8748A]' : 'border-[#1a1a1a]/15 opacity-80 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="Preset avatar" className="w-full h-full object-cover" />
              </button>
            )
          })}
        </div>
        {data.avatarFile && (
          <SquarePhotoCrop ref={cropRef} file={data.avatarFile} shape="circle" onRemove={clearPhoto} />
        )}
      </div>

      {/* Username */}
      <div>
        <FieldLabel>Username</FieldLabel>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.55)] text-sm">@</span>
          <input
            type="text"
            value={data.username}
            onChange={(e) => onChange({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            placeholder="your_username"
            maxLength={20}
            className="w-full pl-8 pr-10 py-3 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-[#1a1a1a] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-primary transition-all text-sm"
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
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SAVING_MESSAGES = [
  'Fetching the balls...',
  'Setting up the net...',
  'Preparing the court...',
  'Lacing up the shoes...',
  'Checking the weather...',
  'Building the schedule...',
  'Finding your opponents...',
  'Refreshing the lines...',
  'Almost ready...',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingMsg, setSavingMsg] = useState(SAVING_MESSAGES[0])
  const [userId, setUserId] = useState('')
  const avatarCropRef = useRef<SquarePhotoCropHandle>(null)

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/sign-in'); return }

      const { data: profile } = await supabase
        .from('profiles').select('skill_level_self, username')
        .eq('id', session.user.id).single()

      if (profile?.skill_level_self) { router.replace('/search'); return }

      setUserId(session.user.id)
      if (profile?.username) setData((prev) => ({ ...prev, username: profile.username }))
      setLoading(false)
    }
    checkAuth()
  }, [router])

  function updateData(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  function canProceed() {
    if (step === 1) return data.city.trim().length > 0
    if (step === 5) return data.username.trim().length >= 3
    return true
  }

  async function saveProfile() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/sign-in'); return false }

    let avatarUrl: string | null = null
    if (data.avatarFile) {
      const square = await avatarCropRef.current?.exportSquare()
      if (!square) return false
      const path = `${session.user.id}/avatar.jpg`
      const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, square, {
        upsert: true,
        contentType: 'image/jpeg',
      })
      if (uploadErr) return false
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      avatarUrl = `${publicUrl}?v=${Date.now()}`
    }

    const schedule = legacySchedule(data.availability)
    const username = data.username.trim()
    await supabase.from('profiles').update({
      city_name: data.city || null,
      city_lat: data.cityLat,
      city_lng: data.cityLng,
      skill_level_self: data.skillLevel,
      years_playing: data.yearsPlaying ? Math.round(data.yearsPlaying) : null,
      preferred_formats: data.playFormats,
      play_style: data.playStyle,
      preferred_surfaces: data.preferredSurfaces,
      preferred_days: schedule.preferred_days,
      preferred_time_start: schedule.preferred_time_start,
      preferred_time_end: schedule.preferred_time_end,
      availability: storedAvailability(data.availability),
      bio: data.bio || null,
      looking_for: data.lookingFor || null,
      ...(username.length >= 3 ? { username } : {}),
      avatar_url: avatarUrl ?? data.presetAvatar,
    }).eq('id', session.user.id)

    return true
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) { setStep(step + 1); return }

    setSaving(true)
    setSavingMsg(SAVING_MESSAGES[0])
    let msgIndex = 0
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % SAVING_MESSAGES.length
      setSavingMsg(SAVING_MESSAGES[msgIndex])
    }, 800)

    try {
      const ok = await saveProfile()
      if (ok) router.push('/search')
    } finally {
      clearInterval(msgInterval)
      setSaving(false)
    }
  }

  async function handleSkipFinish() {
    setSaving(true)
    try {
      const ok = await saveProfile()
      if (ok) router.push('/search')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-6 h-6 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg flex flex-col">
      {/* Top bar */}
      <div className="bg-brand-bg px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {step > 1 ? (
            <button onClick={() => setStep(step - 1)} className="text-[rgba(26,26,26,0.4)] hover:text-[#1a1a1a] transition-colors">
              <ArrowLeft size={18} />
            </button>
          ) : (
            <span className="font-display text-xl tracking-widest text-brand-primary">TENNIS</span>
          )}
          {/* Progress bars */}
          <div className="flex-1 flex gap-1">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-0.5 flex-1 transition-all ${i < step ? 'bg-brand-primary' : 'bg-brand-divider'}`}
              />
            ))}
          </div>
          <span className="text-[9px] tracking-[0.2em] text-[rgba(26,26,26,0.35)] whitespace-nowrap">
            {step} / {TOTAL_STEPS}
          </span>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 py-8">
          {step === 1 && <Step1 data={data} onChange={updateData} />}
          {step === 2 && <Step2 data={data} onChange={updateData} />}
          {step === 3 && <Step3 data={data} onChange={updateData} />}
          {step === 4 && <Step4 data={data} onChange={updateData} />}
          {step === 5 && <Step5 data={data} onChange={updateData} userId={userId} cropRef={avatarCropRef} />}
        </div>
      </div>

      {/* Bottom action */}
      <div className="bg-brand-bg px-4 py-4 safe-area-pb">
        <div className="max-w-lg mx-auto space-y-2">
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="w-full py-3.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.25em] uppercase font-medium hover:bg-[#E8406A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
          >
            {saving && <Loader2 size={14} className="animate-spin flex-shrink-0" />}
            {saving ? savingMsg : step === TOTAL_STEPS ? 'Finish setup' : 'Continue'}
          </button>
          {step > 1 && step < TOTAL_STEPS && (
            <button
              onClick={() => setStep(step + 1)}
              className="w-full py-2 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] hover:text-[rgba(26,26,26,0.6)] transition-colors"
            >
              Skip this step
            </button>
          )}
          {step === TOTAL_STEPS && (
            <button
              onClick={() => void handleSkipFinish()}
              disabled={saving}
              className="w-full py-2 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] hover:text-[rgba(26,26,26,0.6)] transition-colors disabled:opacity-40"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
