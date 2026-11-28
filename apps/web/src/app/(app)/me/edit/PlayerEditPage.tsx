'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Camera, Check, GraduationCap, Loader2, MapPin, Shuffle, Smile, Trophy, UserRound, X, type LucideIcon,
} from 'lucide-react'
import { SquarePhotoCrop, type SquarePhotoCropHandle } from '@/app/(app)/feed/SquarePhotoCrop'
import { CityLocationField } from '@/components/location/CityLocationField'
import { AvailabilityEditor } from '@/components/ui/AvailabilityEditor'
import { CourtDiagram, DOUBLES_PLAYERS, SINGLES_PLAYERS } from '@/components/games/FormatFields'
import {
  FormEyebrow, FormNote, FormSectionLabel, FormSwitch, formChoiceClass, formPanel, formWell,
} from '@/components/ui/FormCard'
import { availabilityFromProfile, legacySchedule, storedAvailability, type Availability } from '@/lib/availability'
import {
  PROFILE_LENGTH_ERROR,
  PROFILE_NAME_MAX,
  PROFILE_USERNAME_MAX,
  exceedsProfileLimit,
} from '@/lib/profile-limits'
// ─── Constants ────────────────────────────────────────────────────────────────

// Fill and text follow the level colors in ref/brand-book-final.md.
const SKILL_LEVELS = [
  { value: 1.5, label: 'Beginner', sub: 'Just started or casual', bars: 1, fill: '#E8E1D7', ink: '#1a1a1a' },
  { value: 2.5, label: 'Intermediate', sub: 'Steady rallies', bars: 2, fill: '#3A8A7A', ink: '#F0EBE3' },
  { value: 4.0, label: 'Advanced', sub: 'Club competitor', bars: 3, fill: '#E8748A', ink: '#1a1a1a' },
  { value: 6.0, label: 'Competitive', sub: 'Ranked, tournaments', bars: 4, fill: '#D4A017', ink: '#1E3A6E' },
]

const FORMAT_OPTIONS = [
  { value: 'singles', label: 'Singles', detail: '2 players', players: SINGLES_PLAYERS },
  { value: 'doubles', label: 'Doubles', detail: '4 players', players: DOUBLES_PLAYERS },
]

const STYLE_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'recreational', label: 'For fun', icon: Smile },
  { value: 'competitive', label: 'To win', icon: Trophy },
  { value: 'both', label: 'Both', icon: Shuffle },
]

const SURFACE_OPTIONS = [
  { value: 'hard', label: 'Hard', color: '#1E3A6E' },
  { value: 'clay', label: 'Clay', color: '#D4622A' },
  { value: 'grass', label: 'Grass', color: '#497250' },
  { value: 'carpet', label: 'Carpet', color: '#85648F' },
  { value: 'synthetic', label: 'Synthetic', color: '#BCD85E' },
]

function LevelBars({ count, color, muted }: { count: number; color: string; muted: string }) {
  return (
    <span className="flex h-5 items-end gap-[3px]" aria-hidden>
      {[1, 2, 3, 4].map((bar) => (
        <span key={bar} className="w-[5px] rounded-full" style={{ height: `${bar * 5}px`, background: bar <= count ? color : muted }} />
      ))}
    </span>
  )
}

function WellField({
  label,
  counter,
  error,
  children,
}: {
  label: string
  counter?: string
  error?: string | null
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        className={`${formWell} block px-4 py-2.5 focus-within:ring-2 ${
          error ? 'ring-2 ring-red-300 focus-within:ring-red-300' : 'focus-within:ring-brand-primary/40'
        }`}
      >
        <span className="flex items-center justify-between gap-2">
          <FormEyebrow>{label}</FormEyebrow>
          {counter && <span className="text-[10px] tabular-nums text-[rgba(26,26,26,0.4)]">{counter}</span>}
        </span>
        {children}
      </label>
      {error && <p className="mt-1.5 px-1 text-[11px] text-red-500">{error}</p>}
    </div>
  )
}

const wellInput = 'mt-0.5 block w-full bg-transparent text-[15px] font-medium text-[#1a1a1a] placeholder:font-normal placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none'
const wellText = 'font-copy mt-1 block w-full resize-none bg-transparent text-[14px] leading-snug text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none'

// ─── Main component ───────────────────────────────────────────────────────────

interface ProfileData {
  fullName: string
  username: string
  bio: string
  avatarUrl: string | null
  avatarFile: File | null
  skillLevel: number | null
  playFormats: string[]
  playStyle: string | null
  preferredSurfaces: string[]
  availability: Availability
  lookingFor: string
  isCoach: boolean
  city: string
  cityLat: number | null
  cityLng: number | null
}

function draftKey(d: ProfileData): string {
  return JSON.stringify({
    fullName: d.fullName.trim(),
    username: d.username.trim(),
    bio: d.bio.trim(),
    skillLevel: d.skillLevel,
    playFormats: [...d.playFormats].sort(),
    playStyle: d.playStyle,
    preferredSurfaces: [...d.preferredSurfaces].sort(),
    availability: d.availability,
    lookingFor: d.lookingFor.trim(),
    isCoach: d.isCoach,
    city: d.city.trim(),
    cityLat: d.cityLat,
    cityLng: d.cityLng,
  })
}

export function PlayerEditPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cropRef = useRef<SquarePhotoCropHandle>(null)

  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [cropError, setCropError] = useState('')
  const [pendingAvatar, setPendingAvatar] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const [originalUsername, setOriginalUsername] = useState('')
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const [d, setD] = useState<ProfileData>({
    fullName: '', username: '', bio: '', avatarUrl: null, avatarFile: null,
    skillLevel: null, playFormats: [], playStyle: null,
    preferredSurfaces: [], availability: {},
    lookingFor: '', isCoach: false, city: '', cityLat: null, cityLng: null,
  })
  const draftRef = useRef(d)
  draftRef.current = d
  const dirtyRef = useRef(false)
  const goneRef = useRef(false)
  const saveTimer = useRef<number | null>(null)
  const savedAt = useRef(0)

  function update(partial: Partial<ProfileData>) {
    dirtyRef.current = true
    setD((prev) => ({ ...prev, ...partial }))
  }

  // Load profile
  useEffect(() => {
    let active = true
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!active) return
      if (!user) { router.push('/sign-in'); return }
      setUserId(user.id)

      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, username, bio, avatar_url, skill_level_self, preferred_formats, play_style, preferred_surfaces, preferred_days, preferred_time_start, preferred_time_end, availability, looking_for, is_coach, city_name, city_lat, city_lng')
        .eq('id', user.id)
        .single()

      if (!active || dirtyRef.current) {
        if (active) setLoading(false)
        return
      }
      if (p) {
        const next: ProfileData = {
          fullName: p.full_name || '',
          username: p.username || '',
          bio: p.bio || '',
          avatarUrl: p.avatar_url || null,
          avatarFile: null,
          skillLevel: p.skill_level_self ?? null,
          playFormats: p.preferred_formats || [],
          playStyle: p.play_style || null,
          preferredSurfaces: p.preferred_surfaces || [],
          availability: availabilityFromProfile(p),
          lookingFor: p.looking_for || '',
          isCoach: Boolean(p.is_coach),
          city: p.city_name || '',
          cityLat: p.city_lat ?? null,
          cityLng: p.city_lng ?? null,
        }
        setOriginalUsername(p.username || '')
        setD(next)
        setSavedKey(draftKey(next))
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    update({ avatarFile: file })
  }

  function clearAvatarFile() {
    update({ avatarFile: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  async function handleApply() {
    if (applying) return
    setApplying(true)
    setCropError('')
    try {
      const square = await cropRef.current?.exportSquare()
      if (!square) throw new Error('Could not prepare the photo. Try again.')
      const url = URL.createObjectURL(square)
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
      previewRef.current = url
      setPreviewUrl(url)
      setPendingAvatar(square)
      clearAvatarFile()
    } catch (err: unknown) {
      setCropError(err instanceof Error ? err.message : 'Could not prepare the photo. Try again.')
    } finally {
      setApplying(false)
    }
  }

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val]
  }

  const nameTooLong = exceedsProfileLimit(d.fullName, PROFILE_NAME_MAX)
  const usernameTooLong = exceedsProfileLimit(d.username, PROFILE_USERNAME_MAX)
  const canSave =
    d.fullName.trim().length > 0
    && d.username.trim().length >= 3
    && !nameTooLong
    && !usernameTooLong
    && usernameStatus !== 'taken'
  const isDirty = savedKey !== null && (draftKey(d) !== savedKey || pendingAvatar !== null)

  function goToProfile() {
    if (goneRef.current) return
    goneRef.current = true
    // A soft push reuses /me from the 30s client cache, so the saved bio stays old.
    window.location.assign('/me')
  }

  function finishSaved() {
    if (Date.now() - savedAt.current < 400) return
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    setSaveStatus(null)
    goToProfile()
  }

  function handleBack() {
    if (isDirty) {
      setLeaveOpen(true)
      return
    }
    router.back()
  }

  async function handleSave() {
    if (!userId || saveStatus === 'saving') return
    const draft = draftRef.current
    if (
      exceedsProfileLimit(draft.fullName, PROFILE_NAME_MAX)
      || exceedsProfileLimit(draft.username, PROFILE_USERNAME_MAX)
    ) {
      setError(PROFILE_LENGTH_ERROR)
      setSaveStatus('error')
      return
    }
    if (!canSave) return
    setSaveStatus('saving')
    setError('')
    try {
      let avatarUrl = draft.avatarUrl
      if (pendingAvatar) {
        const path = `${userId}/avatar.jpg`
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, pendingAvatar, {
          upsert: true,
          contentType: 'image/jpeg',
        })
        if (uploadErr) throw uploadErr
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
        avatarUrl = `${publicUrl}?v=${Date.now()}`
      }

      const schedule = legacySchedule(draft.availability)
      const { error: updateErr } = await supabase.from('profiles').update({
        full_name: draft.fullName.trim(),
        username: draft.username.trim(),
        bio: draft.bio.trim() || null,
        avatar_url: avatarUrl,
        skill_level_self: draft.isCoach ? null : draft.skillLevel,
        preferred_formats: draft.playFormats,
        play_style: draft.playStyle,
        preferred_surfaces: draft.preferredSurfaces,
        preferred_days: schedule.preferred_days,
        preferred_time_start: schedule.preferred_time_start,
        preferred_time_end: schedule.preferred_time_end,
        availability: storedAvailability(draft.availability),
        looking_for: draft.lookingFor.trim() || null,
        is_coach: draft.isCoach,
        city_name: draft.city.trim() || null,
        city_lat: draft.cityLat,
        city_lng: draft.cityLng,
      }).eq('id', userId)

      if (updateErr) throw updateErr
      setPendingAvatar(null)
      setSavedKey(draftKey(draft))
      setLeaveOpen(false)
      savedAt.current = Date.now()
      setSaveStatus('saved')
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        setSaveStatus(null)
        goToProfile()
      }, 1000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
      setSaveStatus('error')
    }
  }

  const displayAvatar = previewUrl || d.avatarUrl

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg">
        <div className="w-6 h-6 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (d.avatarFile) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <div className="page-header">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <button onClick={clearAvatarFile} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.5)]" />
            </button>
            <span className="font-display text-3xl tracking-wide flex-1">PHOTO</span>
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={applying}
              className="px-4 py-1.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-40"
            >
              {applying ? <Loader2 size={12} className="animate-spin" /> : 'Apply'}
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-6">
          <SquarePhotoCrop ref={cropRef} file={d.avatarFile} shape="circle" outputSize={512} quality={0.8} onRemove={clearAvatarFile} />
          {cropError && <p className="text-sm text-red-600 mt-3">{cropError}</p>}
        </div>
      </div>
    )
  }

  const usernameError = usernameTooLong ? PROFILE_LENGTH_ERROR : usernameStatus === 'taken' ? 'Already taken' : null

  return (
    <div className="min-h-screen bg-brand-bg pb-10">
      <div className="page-header">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1a1a1a]/10 bg-white transition-colors hover:bg-brand-surface"
          >
            <ArrowLeft size={17} className="text-[rgba(26,26,26,0.6)]" />
          </button>
          <span className="flex-1 font-display text-[28px] leading-none tracking-wide">EDIT PROFILE</span>
          <button
            onClick={() => void handleSave()}
            disabled={saveStatus === 'saving' || !canSave}
            className="rounded-full bg-[#3A8A7A] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#F0EBE3] transition-colors hover:bg-[#2F7466] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
        <section>
          <FormSectionLabel>Profile</FormSectionLabel>
          <div className={`${formPanel} space-y-3`}>
            <div className="flex items-center gap-4 pb-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Change photo"
                className="relative h-[76px] w-[76px] flex-none rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50"
              >
                <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-brand-surface">
                  {displayAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={30} strokeWidth={1.5} className="text-[rgba(26,26,26,0.35)]" />
                  )}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-white text-[#1a1a1a] shadow-[0_1px_4px_rgba(26,26,26,0.25)]">
                  <Camera size={13} strokeWidth={2} />
                </span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[26px] uppercase leading-none tracking-wide text-[#1a1a1a]">
                  {d.fullName.trim() || 'Your name'}
                </p>
                <p className="mt-1 truncate text-[12.5px] text-[rgba(26,26,26,0.5)]">@{d.username || 'username'}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 rounded-full bg-brand-surface px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-[rgba(26,26,26,0.65)] transition-colors hover:bg-brand-field"
                >
                  {displayAvatar ? 'Change photo' : 'Add photo'}
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            <WellField label="Name" counter={`${d.fullName.length}/${PROFILE_NAME_MAX}`} error={nameTooLong ? PROFILE_LENGTH_ERROR : null}>
              <input
                type="text"
                value={d.fullName}
                onChange={(e) => update({ fullName: e.target.value.slice(0, PROFILE_NAME_MAX) })}
                maxLength={PROFILE_NAME_MAX}
                placeholder="Your name"
                aria-invalid={nameTooLong}
                className={wellInput}
              />
            </WellField>

            <WellField label="Username" counter={`${d.username.length}/${PROFILE_USERNAME_MAX}`} error={usernameError}>
              <span className="mt-0.5 flex items-center gap-1">
                <span className="text-[15px] font-medium text-[rgba(26,26,26,0.4)]">@</span>
                <input
                  type="text"
                  value={d.username}
                  onChange={(e) => update({
                    username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, PROFILE_USERNAME_MAX),
                  })}
                  maxLength={PROFILE_USERNAME_MAX}
                  placeholder="username"
                  aria-invalid={usernameTooLong || usernameStatus === 'taken'}
                  className={`${wellInput} mt-0 min-w-0 flex-1`}
                />
                {usernameStatus === 'checking' && <Loader2 size={15} className="flex-none animate-spin text-[rgba(26,26,26,0.35)]" />}
                {usernameStatus === 'available' && <Check size={15} className="flex-none text-brand-primary" />}
                {usernameStatus === 'taken' && <X size={15} className="flex-none text-red-500" />}
              </span>
            </WellField>
          </div>
        </section>

        <section>
          <FormSectionLabel hint="(optional)">About you</FormSectionLabel>
          <div className={`${formPanel} space-y-3`}>
            <WellField label="Bio" counter={`${d.bio.length}/300`}>
              <textarea
                value={d.bio}
                onChange={(e) => update({ bio: e.target.value })}
                rows={3}
                maxLength={300}
                placeholder="A few words about yourself"
                className={wellText}
              />
            </WellField>
            <WellField label="Looking for" counter={`${d.lookingFor.length}/300`}>
              <textarea
                value={d.lookingFor}
                onChange={(e) => update({ lookingFor: e.target.value })}
                rows={2}
                maxLength={300}
                placeholder="A partner for friendly matches 1–2x a week"
                className={wellText}
              />
            </WellField>
          </div>
        </section>

        <section>
          <FormSectionLabel>City</FormSectionLabel>
          <div className={`${formPanel} space-y-3`}>
            <CityLocationField
              value={d.city}
              onChange={(city, coords) => update({ city, cityLat: coords?.lat ?? null, cityLng: coords?.lng ?? null })}
              helper=""
              placeholder="Search your city"
              inputClassName="h-12 rounded-[20px] border-0 bg-brand-surface focus:ring-2 focus:ring-brand-primary/40"
            />
            <FormNote icon={<MapPin size={15} strokeWidth={1.7} />}>
              {d.city.trim() ? 'Used for courts, players, and games near you' : 'Add a city so Discover can show people near you'}
            </FormNote>
          </div>
        </section>

        <section>
          <FormSectionLabel hint="(optional)">When you play</FormSectionLabel>
          <div className={formPanel}>
            <AvailabilityEditor value={d.availability} onChange={(availability) => update({ availability })} framed={false} />
          </div>
        </section>

        <section>
          <FormSectionLabel hint="(optional)">Your level</FormSectionLabel>
          <div className="space-y-2.5">
            <div className={`${formPanel} flex items-center gap-3 py-3.5`}>
              <span
                className={`grid h-11 w-11 flex-none place-items-center rounded-[16px] transition-colors ${
                  d.isCoach ? 'bg-brand-primary text-[#F0EBE3]' : 'bg-brand-surface text-[rgba(26,26,26,0.5)]'
                }`}
                aria-hidden
              >
                <GraduationCap size={21} strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[#1a1a1a]">I&apos;m a coach</span>
                <span className="block text-[12px] text-[rgba(26,26,26,0.5)]">A Coach badge shows on your profile</span>
              </span>
              <FormSwitch checked={d.isCoach} onChange={(isCoach) => update({ isCoach })} label="I'm a coach" />
            </div>

            {!d.isCoach && (
              <div className={`${formPanel} p-2`}>
                                <div className="grid grid-cols-2 gap-2">
                  {SKILL_LEVELS.map((s) => {
                    const selected = d.skillLevel === s.value
                    return (
                      <button
                        key={s.value}
                        type="button"
                        onClick={() => update({ skillLevel: selected ? null : s.value })}
                        aria-pressed={selected}
                        className={`flex flex-col items-start gap-2 rounded-[20px] border px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                          selected ? 'border-transparent' : 'border-transparent bg-brand-surface hover:border-[#1a1a1a]/15'
                        }`}
                        style={selected ? { background: s.fill, color: s.ink, borderColor: s.value === 1.5 ? 'rgba(26,26,26,0.25)' : 'transparent' } : undefined}
                      >
                        <LevelBars
                          count={s.bars}
                          color={selected ? s.ink : s.value === 1.5 ? '#A89078' : s.fill}
                          muted={selected ? `${s.ink}33` : 'rgba(26,26,26,0.12)'}
                        />
                        <span>
                          <span className="block text-[14px] font-semibold leading-tight">{s.label}</span>
                          <span className={`block text-[11.5px] ${selected ? 'opacity-75' : 'text-[rgba(26,26,26,0.5)]'}`}>{s.sub}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </section>

        <section>
          <FormSectionLabel hint="(optional)">Preferences</FormSectionLabel>
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Preferred format">
              {FORMAT_OPTIONS.map((o) => {
                const selected = d.playFormats.includes(o.value)
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => update({ playFormats: toggleArr(d.playFormats, o.value) })}
                    className={`relative flex items-center gap-3 rounded-[20px] px-3.5 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                      selected ? 'bg-brand-primary text-[#F0EBE3]' : 'bg-white text-[#1a1a1a] hover:bg-white/70'
                    }`}
                  >
                    <CourtDiagram players={o.players} selected={selected} />
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-tight">{o.label}</span>
                      <span className={`block text-[12px] ${selected ? 'text-[#F0EBE3]/75' : 'text-[rgba(26,26,26,0.5)]'}`}>{o.detail}</span>
                    </span>
                    <span
                      className={`absolute right-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] ${
                        selected ? 'border-brand-conifer bg-brand-conifer text-brand-primary-dark' : 'border-[#1a1a1a]/15'
                      }`}
                      aria-hidden
                    >
                      {selected && <Check size={11} strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className={`${formPanel} p-2`}>
              <FormEyebrow className="px-2 pb-2 pt-1.5">Court surfaces</FormEyebrow>
              <div className="flex flex-wrap gap-2">
                {SURFACE_OPTIONS.map((o) => {
                  const selected = d.preferredSurfaces.includes(o.value)
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update({ preferredSurfaces: toggleArr(d.preferredSurfaces, o.value) })}
                      className={`flex h-10 items-center gap-2 rounded-full pl-2 pr-3.5 text-[13px] font-semibold ${formChoiceClass(selected)}`}
                    >
                      <span className="h-6 w-[18px] rounded-[4px] border border-white/60" style={{ background: o.color }} aria-hidden />
                      {o.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={`${formPanel} p-2`}>
              <FormEyebrow className="px-2 pb-2 pt-1.5">I play</FormEyebrow>
              <div className="grid grid-cols-3 gap-2">
                {STYLE_OPTIONS.map((o) => {
                  const selected = d.playStyle === o.value
                  const Icon = o.icon
                  return (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => update({ playStyle: selected ? null : o.value })}
                      className={`flex flex-col items-center gap-1.5 rounded-[20px] px-1 py-3.5 ${formChoiceClass(selected)}`}
                    >
                      <Icon size={20} strokeWidth={1.7} className={selected ? 'text-[#E8748A]' : 'text-[rgba(26,26,26,0.45)]'} aria-hidden />
                      <span className="text-[14px] font-semibold leading-tight">{o.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
      {saveStatus && (
        <SaveNotice
          status={saveStatus}
          message={error}
          onClose={() => setSaveStatus(null)}
          onSavedDismiss={finishSaved}
        />
      )}
      {leaveOpen && (
        <UnsavedChangesDialog
          canSave={canSave && saveStatus !== 'saving'}
          onDismiss={() => setLeaveOpen(false)}
          onDiscard={() => {
            setLeaveOpen(false)
            router.back()
          }}
          onSave={() => {
            setLeaveOpen(false)
            void handleSave()
          }}
        />
      )}
    </div>
  )
}

function SaveNotice({
  status,
  message,
  onClose,
  onSavedDismiss,
}: {
  status: 'saving' | 'saved' | 'error'
  message: string
  onClose: () => void
  onSavedDismiss: () => void
}) {
  function dismiss() {
    if (status === 'saving') return
    if (status === 'saved') onSavedDismiss()
    else onClose()
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6 bg-black/25"
      onClick={dismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={status === 'saved' ? 'Saved' : status === 'saving' ? 'Saving' : 'Something went wrong'}
        className="w-full max-w-[220px] rounded-[24px] bg-white px-5 py-6 text-center shadow-[0_12px_40px_rgba(26,26,26,0.16)]"
        onClick={(event) => {
          if (status !== 'saved') event.stopPropagation()
        }}
      >
        {status === 'saving' && (
          <>
            <Loader2 size={22} className="mx-auto animate-spin text-[#E8748A]" />
            <p className="mt-3 text-[10px] tracking-[0.18em] uppercase font-medium text-[#1a1a1a]">Saving</p>
          </>
        )}
        {status === 'saved' && (
          <>
            <div className="mx-auto w-8 h-8 rounded-full bg-[#3A8A7A] flex items-center justify-center">
              <Check size={16} className="text-[#F0EBE3]" />
            </div>
            <p className="mt-3 text-[10px] tracking-[0.18em] uppercase font-medium text-[#1a1a1a]">Saved</p>
          </>
        )}
        {status === 'error' && (
          <>
            <p className="text-[10px] tracking-[0.16em] uppercase font-medium text-[#1a1a1a]">Something went wrong</p>
            {message && <p className="mt-2 text-xs text-[rgba(26,26,26,0.55)]">{message}</p>}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 px-4 py-1.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.16em] uppercase font-medium"
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function UnsavedChangesDialog({
  canSave,
  onDismiss,
  onDiscard,
  onSave,
}: {
  canSave: boolean
  onDismiss: () => void
  onDiscard: () => void
  onSave: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-6 bg-black/25"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
        className="relative w-full max-w-sm rounded-[28px] bg-white px-5 pb-5 pt-6 shadow-[0_12px_40px_rgba(26,26,26,0.16)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 rounded-full bg-brand-field border border-[#1a1a1a]/15 flex items-center justify-center"
        >
          <X size={14} className="text-[rgba(26,26,26,0.55)]" />
        </button>
        <h2 id="unsaved-title" className="font-display text-3xl tracking-wide pr-8 text-[#1a1a1a]">Unsaved changes</h2>
        <p className="mt-2 font-copy text-sm text-[rgba(26,26,26,0.6)]">You have changes that are not saved yet.</p>
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave}
          className="mt-5 w-full py-3 rounded-full bg-[#3A8A7A] text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#2F7466] transition-colors disabled:opacity-40"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="mt-2 w-full py-3 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
