'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Camera, Check, Loader2, X } from 'lucide-react'
import { CityInput } from '@/components/ui/CityInput'
import { AvailabilityEditor } from '@/components/ui/AvailabilityEditor'
import { availabilityFromProfile, legacySchedule, storedAvailability, type Availability } from '@/lib/availability'

// ─── Constants ────────────────────────────────────────────────────────────────

const SKILL_LEVELS = [
  { value: 1.5, label: 'Beginner', sub: 'Just started or playing casually' },
  { value: 2.5, label: 'Intermediate', sub: 'Consistent rallies, learning strategy' },
  { value: 4.0, label: 'Advanced', sub: 'Competitive club player' },
  { value: 6.0, label: 'Competitive', sub: 'Ranked player, tournament regular' },
]

const YEARS_OPTIONS = [
  { value: 0.5, label: '< 1 year' },
  { value: 1.5, label: '1–2 years' },
  { value: 3.5, label: '2–5 years' },
  { value: 7.5, label: '5–10 years' },
  { value: 15, label: '10+ years' },
]

const FORMAT_OPTIONS = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
]

const STYLE_OPTIONS = [
  { value: 'recreational', label: 'Recreational', sub: 'Just for fun' },
  { value: 'competitive', label: 'Competitive', sub: 'I play to win' },
  { value: 'both', label: 'Both', sub: 'Depends on the match' },
]

const SURFACE_OPTIONS = [
  { value: 'hard', label: 'Hard' },
  { value: 'clay', label: 'Clay' },
  { value: 'grass', label: 'Grass' },
  { value: 'indoor', label: 'Indoor' },
]

const DISTANCE_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
  { value: 50, label: '50 km+' },
]

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3 pt-8">
      <span className="text-brand-accent font-display text-lg">✦</span>
      <span className="text-[9px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.45)]">{children}</span>
      <div className="flex-1 h-px bg-brand-divider" />
    </div>
  )
}

function FieldLabel({ children, optional, tight }: { children: string; optional?: boolean; tight?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)] ${tight ? 'mb-2.5' : 'mb-4'}`}>
      {children}
      {optional && <span className="text-[rgba(26,26,26,0.25)] normal-case tracking-normal text-[9px]">optional</span>}
    </label>
  )
}

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
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

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileData {
  fullName: string
  username: string
  bio: string
  avatarUrl: string | null
  avatarFile: File | null
  avatarPreview: string | null
  skillLevel: number | null
  yearsPlaying: number | null
  playFormats: string[]
  playStyle: string | null
  preferredSurfaces: string[]
  availability: Availability
  maxTravelKm: number | null
  lookingFor: string
  city: string
  cityLat: number | null
  cityLng: number | null
}

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [originalUsername, setOriginalUsername] = useState('')

  const [d, setD] = useState<ProfileData>({
    fullName: '', username: '', bio: '', avatarUrl: null, avatarFile: null, avatarPreview: null,
    skillLevel: null, yearsPlaying: null, playFormats: [], playStyle: null,
    preferredSurfaces: [], availability: {},
    maxTravelKm: null, lookingFor: '', city: '', cityLat: null, cityLng: null,
  })

  function update(partial: Partial<ProfileData>) {
    setD((prev) => ({ ...prev, ...partial }))
  }

  // Load profile
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, username, bio, avatar_url, skill_level_self, years_playing, preferred_formats, play_style, preferred_surfaces, preferred_days, preferred_time_start, preferred_time_end, availability, max_travel_km, looking_for, city_name')
        .eq('id', user.id)
        .single()

      if (p) {
        setOriginalUsername(p.username || '')
        update({
          fullName: p.full_name || '',
          username: p.username || '',
          bio: p.bio || '',
          avatarUrl: p.avatar_url || null,
          skillLevel: p.skill_level_self ?? null,
          yearsPlaying: p.years_playing ?? null,
          playFormats: p.preferred_formats || [],
          playStyle: p.play_style || null,
          preferredSurfaces: p.preferred_surfaces || [],
          availability: availabilityFromProfile(p),
          maxTravelKm: p.max_travel_km ?? null,
          lookingFor: p.looking_for || '',
          city: p.city_name || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [])

  // Username check
  useEffect(() => {
    if (!userId) return
    if (d.username === originalUsername) { setUsernameStatus('idle'); return }
    if (d.username.length < 3) { setUsernameStatus('idle'); return }
    setUsernameStatus('checking')
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles').select('id')
        .eq('username', d.username.trim())
        .neq('id', userId)
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 500)
    return () => clearTimeout(timer)
  }, [d.username, userId, originalUsername])

  // Cleanup avatar preview
  useEffect(() => {
    return () => { if (d.avatarPreview) URL.revokeObjectURL(d.avatarPreview) }
  }, [d.avatarPreview])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    if (d.avatarPreview) URL.revokeObjectURL(d.avatarPreview)
    update({
      avatarFile: file,
      avatarPreview: file ? URL.createObjectURL(file) : null,
    })
  }

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
  }

  const canSave = d.fullName.trim().length > 0 && d.username.trim().length >= 3 && usernameStatus !== 'taken'

  async function handleSave() {
    if (!canSave || !userId) return
    setSaving(true)
    setError('')
    try {
      let avatarUrl = d.avatarUrl
      if (d.avatarFile) {
        const ext = d.avatarFile.name.split('.').pop()
        const path = `${userId}/avatar.${ext}`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, d.avatarFile, { upsert: true })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = publicUrl
      }

      const schedule = legacySchedule(d.availability)
      const { error: updateErr } = await supabase.from('profiles').update({
        full_name: d.fullName.trim(),
        username: d.username.trim(),
        bio: d.bio.trim() || null,
        avatar_url: avatarUrl,
        skill_level_self: d.skillLevel,
        years_playing: d.yearsPlaying ? Math.round(d.yearsPlaying) : null,
        preferred_formats: d.playFormats,
        play_style: d.playStyle,
        preferred_surfaces: d.preferredSurfaces,
        preferred_days: schedule.preferred_days,
        preferred_time_start: schedule.preferred_time_start,
        preferred_time_end: schedule.preferred_time_end,
        availability: storedAvailability(d.availability),
        max_travel_km: d.maxTravelKm,
        looking_for: d.lookingFor.trim() || null,
        city_name: d.city.trim() || null,
        city_lat: d.cityLat,
        city_lng: d.cityLng,
      }).eq('id', userId)

      if (updateErr) throw updateErr
      router.push('/me')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const displayAvatar = d.avatarPreview || d.avatarUrl

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-6 h-6 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-32 md:pb-12 bg-brand-bg">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.5)]" />
          </button>
          <span className="font-display text-3xl tracking-wide flex-1">EDIT PROFILE</span>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="px-4 py-1.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-10">
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {/* ── ABOUT ── */}
        <div className="flex items-center gap-3">
          <span className="text-brand-accent font-display text-lg">✦</span>
          <span className="text-[9px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.45)]">About</span>
          <div className="flex-1 h-px bg-brand-divider" />
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div
            className="relative w-20 h-20 rounded-full bg-brand-field border border-[#1a1a1a]/40 overflow-hidden cursor-pointer flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            {displayAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={displayAvatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-3xl">👤</span>
            )}
            <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <Camera size={18} className="text-white" />
            </div>
          </div>
          <div>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] tracking-[0.15em] uppercase text-brand-primary font-medium hover:underline">
              Change photo
            </button>
            <p className="text-[9px] text-[rgba(26,26,26,0.35)] mt-0.5">Optional</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Name */}
        <div>
          <FieldLabel>Name</FieldLabel>
          <input
            type="text"
            value={d.fullName}
            onChange={(e) => update({ fullName: e.target.value })}
            className="w-full px-3 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
            placeholder="Your name"
          />
        </div>

        {/* Username */}
        <div>
          <FieldLabel>Username</FieldLabel>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.55)] text-sm">@</span>
            <input
              type="text"
              value={d.username}
              onChange={(e) => update({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
              className="w-full pl-7 pr-8 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder="username"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {usernameStatus === 'checking' && <Loader2 size={14} className="animate-spin text-[rgba(26,26,26,0.3)]" />}
              {usernameStatus === 'available' && <Check size={14} className="text-brand-primary" />}
              {usernameStatus === 'taken' && <X size={14} className="text-red-500" />}
            </div>
          </div>
          {usernameStatus === 'taken' && <p className="text-[10px] text-red-500 mt-1">Already taken</p>}
        </div>

        {/* Bio */}
        <div>
          <FieldLabel optional>Bio</FieldLabel>
          <textarea
            value={d.bio}
            onChange={(e) => update({ bio: e.target.value })}
            rows={3}
            maxLength={300}
            className="w-full min-h-[96px] px-3 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
            placeholder="A few words about yourself..."
          />
          <p className="text-[9px] text-[rgba(26,26,26,0.45)] text-right mt-2">{d.bio.length}/300</p>
        </div>

        {/* ── YOUR GAME ── small choices, so the gaps stay tighter than the large fields */}
        <div>
          <div className="flex items-center gap-3">
            <span className="text-brand-accent font-display text-lg">✦</span>
            <span className="text-[9px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.45)]">Your game</span>
            <div className="flex-1 h-px bg-brand-divider" />
          </div>

          <div className="mt-4 space-y-6">
            <div>
              <FieldLabel optional tight>Level</FieldLabel>
              <div className="grid grid-cols-2 gap-3">
                {SKILL_LEVELS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => update({ skillLevel: d.skillLevel === s.value ? null : s.value })}
                    className={`flex flex-col p-3 border text-left transition-colors ${
                      d.skillLevel === s.value
                        ? 'rounded-[20px] border-[#E8748A] bg-[#E8748A]'
                        : 'rounded-[20px] bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
                    }`}
                  >
                    <span className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[#1a1a1a]">{s.label}</span>
                    <span className={`text-[9px] mt-0.5 ${d.skillLevel === s.value ? 'text-[#1a1a1a]/80' : 'text-[rgba(26,26,26,0.55)]'}`}>{s.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional tight>Playing since</FieldLabel>
              <div className="flex flex-wrap gap-2.5">
                {YEARS_OPTIONS.map((o) => (
                  <Pill key={o.value} active={d.yearsPlaying === o.value} onClick={() => update({ yearsPlaying: d.yearsPlaying === o.value ? null : o.value })}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional tight>Preferred format</FieldLabel>
              <div className="flex flex-wrap gap-2.5">
                {FORMAT_OPTIONS.map((o) => (
                  <Pill key={o.value} active={d.playFormats.includes(o.value)} onClick={() => update({ playFormats: toggleArr(d.playFormats, o.value) })}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional tight>Court surfaces</FieldLabel>
              <div className="flex flex-wrap gap-2.5">
                {SURFACE_OPTIONS.map((o) => (
                  <Pill key={o.value} active={d.preferredSurfaces.includes(o.value)} onClick={() => update({ preferredSurfaces: toggleArr(d.preferredSurfaces, o.value) })}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel optional tight>Play style</FieldLabel>
              <div className="grid grid-cols-3 gap-3">
                {STYLE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => update({ playStyle: d.playStyle === o.value ? null : o.value })}
                    className={`flex flex-col p-3 border text-left transition-colors ${
                      d.playStyle === o.value
                        ? 'rounded-[20px] border-[#E8748A] bg-[#E8748A]'
                        : 'rounded-[20px] bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
                    }`}
                  >
                    <span className="text-[10px] tracking-[0.1em] uppercase font-semibold text-[#1a1a1a]">{o.label}</span>
                    <span className={`text-[9px] mt-0.5 ${d.playStyle === o.value ? 'text-[#1a1a1a]/80' : 'text-[rgba(26,26,26,0.55)]'}`}>{o.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── SCHEDULE ── */}
        <SectionTitle>Schedule</SectionTitle>

        {/* Days and the parts of those days */}
        <div>
          <FieldLabel optional>When you play</FieldLabel>
          <AvailabilityEditor value={d.availability} onChange={(availability) => update({ availability })} />
        </div>

        {/* Distance */}
        <div>
          <FieldLabel optional>Max travel distance</FieldLabel>
          <div className="flex flex-wrap gap-4">
            {DISTANCE_OPTIONS.map((o) => (
              <Pill key={o.value} active={d.maxTravelKm === o.value} onClick={() => update({ maxTravelKm: d.maxTravelKm === o.value ? null : o.value })}>
                {o.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* ── LOOKING FOR ── */}
        <SectionTitle>Looking for</SectionTitle>

        <div>
          <FieldLabel optional>Who are you looking to play with?</FieldLabel>
          <textarea
            value={d.lookingFor}
            onChange={(e) => update({ lookingFor: e.target.value })}
            rows={3}
            maxLength={300}
            className="w-full px-3 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary resize-none"
            placeholder="e.g. A partner around 3.0–3.5 for friendly matches 1–2x per week..."
          />
          <p className="text-[9px] text-[rgba(26,26,26,0.45)] text-right mt-2">{d.lookingFor.length}/300</p>
        </div>

        {/* ── LOCATION ── */}
        <SectionTitle>Location</SectionTitle>

        <div>
          <FieldLabel>City</FieldLabel>
          <p className="text-[11px] text-[rgba(26,26,26,0.45)] mb-2">Discover uses this city to show players, games, and courts near you.</p>
          <CityInput
            value={d.city}
            onChange={(city, coords) => update({ city, cityLat: coords?.lat ?? null, cityLng: coords?.lng ?? null })}
            placeholder="Search your city..."
          />
          {!d.city.trim() && (
            <p className="mt-1.5 text-[11px] text-[rgba(26,26,26,0.5)]">Without a city, Discover cannot show people near you.</p>
          )}
        </div>
      </div>
    </div>
  )
}
