'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Check, Loader2, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────────────────────

interface OnboardingData {
  city: string
  neighborhood: string
  yearsPlaying: number | null
  skillLevel: number | null
  playFormats: string[]
  playStyle: string | null
  preferredSurfaces: string[]
  preferredDays: number[]
  preferredTimeStart: string | null
  preferredTimeEnd: string | null
  maxTravelKm: number | null
  bio: string
  lookingFor: string
  username: string
  avatarFile: File | null
}

const INITIAL_DATA: OnboardingData = {
  city: '',
  neighborhood: '',
  yearsPlaying: null,
  skillLevel: null,
  playFormats: [],
  playStyle: null,
  preferredSurfaces: [],
  preferredDays: [],
  preferredTimeStart: null,
  preferredTimeEnd: null,
  maxTravelKm: 10,
  bio: '',
  lookingFor: '',
  username: '',
  avatarFile: null,
}

const TOTAL_STEPS = 5

// ─── Step 1: Location ────────────────────────────────────────────────────────

function Step1({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Where do you play?</h2>
        <p className="text-gray-500 text-sm">We&apos;ll show you players and courts near you.</p>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
          <input
            type="text"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="e.g. Belgrade, London, New York..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Neighbourhood <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="text"
            value={data.neighborhood}
            onChange={(e) => onChange({ neighborhood: e.target.value })}
            placeholder="e.g. Vra&#269;ar, Chelsea, Brooklyn..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
          />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Tennis profile ───────────────────────────────────────────────────

const SKILL_LEVELS = [
  { value: 1.5, label: 'Beginner', sublabel: 'Just started or playing casually', emoji: '🌱' },
  { value: 2.5, label: 'Intermediate', sublabel: 'Consistent rallies, learning strategy', emoji: '🎾' },
  { value: 4.0, label: 'Advanced', sublabel: 'Competitive club player, tournament experience', emoji: '⚡' },
  { value: 6.0, label: 'Competitive', sublabel: 'Ranked player, tournament regular', emoji: '🏆' },
]

const YEARS_OPTIONS = [
  { value: 0.5, label: 'Less than 1 year' },
  { value: 1.5, label: '1–2 years' },
  { value: 3.5, label: '2–5 years' },
  { value: 7.5, label: '5–10 years' },
  { value: 15, label: '10+ years' },
]

const FORMAT_OPTIONS = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'mixed_doubles', label: 'Mixed doubles' },
]

const STYLE_OPTIONS = [
  { value: 'recreational', label: '😊 Recreational', sublabel: 'Just for fun' },
  { value: 'competitive', label: '🔥 Competitive', sublabel: 'I play to win' },
  { value: 'both', label: '⚖️ Both', sublabel: 'Depends on the match' },
]

function PillButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
        active
          ? 'bg-green-600 text-white border-green-600'
          : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
      }`}
    >
      {children}
    </button>
  )
}

function Step2({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  function toggleFormat(v: string) {
    const has = data.playFormats.includes(v)
    onChange({ playFormats: has ? data.playFormats.filter((f) => f !== v) : [...data.playFormats, v] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Your tennis</h2>
        <p className="text-gray-500 text-sm">Tell us about your game so we can find the right players for you.</p>
      </div>

      {/* Years playing */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">How long have you been playing?</label>
        <div className="flex flex-wrap gap-2">
          {YEARS_OPTIONS.map((o) => (
            <PillButton key={o.value} active={data.yearsPlaying === o.value} onClick={() => onChange({ yearsPlaying: o.value })}>
              {o.label}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Skill level */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Your level</label>
        <div className="grid grid-cols-2 gap-2">
          {SKILL_LEVELS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ skillLevel: s.value })}
              className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                data.skillLevel === s.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-green-200'
              }`}
            >
              <span className="text-xl">{s.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sublabel}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Play format */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred format</label>
        <div className="flex flex-wrap gap-2">
          {FORMAT_OPTIONS.map((o) => (
            <PillButton key={o.value} active={data.playFormats.includes(o.value)} onClick={() => toggleFormat(o.value)}>
              {o.label}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Play style */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">How do you like to play?</label>
        <div className="space-y-2">
          {STYLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange({ playStyle: o.value })}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                data.playStyle === o.value
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-green-200'
              }`}
            >
              <span className="text-sm font-semibold text-gray-900">{o.label}</span>
              <span className="text-xs text-gray-500">{o.sublabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Schedule ─────────────────────────────────────────────────────────

const DAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

const TIME_SLOTS = [
  { label: '🌅 Morning', sublabel: '6:00–12:00', start: '06:00', end: '12:00' },
  { label: '☀️ Afternoon', sublabel: '12:00–17:00', start: '12:00', end: '17:00' },
  { label: '🌆 Evening', sublabel: '17:00–21:00', start: '17:00', end: '21:00' },
  { label: '🌙 Night', sublabel: '21:00–00:00', start: '21:00', end: '23:59' },
]

const DISTANCE_OPTIONS = [
  { value: 5, label: '5 km' },
  { value: 10, label: '10 km' },
  { value: 20, label: '20 km' },
  { value: 50, label: '50 km+' },
]

function Step3({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  function toggleDay(v: number) {
    const has = data.preferredDays.includes(v)
    onChange({ preferredDays: has ? data.preferredDays.filter((d) => d !== v) : [...data.preferredDays, v] })
  }

  const activeTimeSlot = TIME_SLOTS.find(
    (t) => t.start === data.preferredTimeStart && t.end === data.preferredTimeEnd,
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">When do you play?</h2>
        <p className="text-gray-500 text-sm">Help us match you with players who share your schedule.</p>
      </div>

      {/* Days */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred days</label>
        <div className="flex gap-2 flex-wrap">
          {DAYS.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`w-11 h-11 rounded-full text-sm font-medium border-2 transition-all ${
                data.preferredDays.includes(d.value)
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-green-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred time</label>
        <div className="grid grid-cols-2 gap-2">
          {TIME_SLOTS.map((t) => (
            <button
              key={t.start}
              type="button"
              onClick={() => onChange({ preferredTimeStart: t.start, preferredTimeEnd: t.end })}
              className={`flex flex-col items-start px-4 py-3 rounded-xl border-2 text-left transition-all ${
                activeTimeSlot?.start === t.start
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-green-200'
              }`}
            >
              <span className="text-sm font-semibold text-gray-900">{t.label}</span>
              <span className="text-xs text-gray-500">{t.sublabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Distance */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">How far will you travel?</label>
        <div className="flex gap-2 flex-wrap">
          {DISTANCE_OPTIONS.map((d) => (
            <PillButton key={d.value} active={data.maxTravelKm === d.value} onClick={() => onChange({ maxTravelKm: d.value })}>
              {d.label}
            </PillButton>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: About you ────────────────────────────────────────────────────────

function Step4({ data, onChange }: { data: OnboardingData; onChange: (d: Partial<OnboardingData>) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">About you</h2>
        <p className="text-gray-500 text-sm">Let other players know who you are.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          A few words about yourself <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={data.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder="e.g. I love long baseline rallies and play a few times a week after work. Big fan of clay courts..."
          rows={3}
          maxLength={300}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none text-sm"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{data.bio.length}/300</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Who are you looking for? <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={data.lookingFor}
          onChange={(e) => onChange({ lookingFor: e.target.value })}
          placeholder="e.g. A partner around 3.0–3.5 for friendly matches 1–2x per week. Patient and fun to play with..."
          rows={3}
          maxLength={300}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all resize-none text-sm"
        />
        <p className="text-xs text-gray-400 mt-1 text-right">{data.lookingFor.length}/300</p>
      </div>

      <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-3">
        <p className="text-sm text-green-800">
          🎾 You can always update your profile later from the <strong>Me</strong> section.
        </p>
      </div>
    </div>
  )
}

// ─── Step 5: Avatar + Username ───────────────────────────────────────────────

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'

function Step5({
  data,
  onChange,
  userId,
}: {
  data: OnboardingData
  onChange: (d: Partial<OnboardingData>) => void
  userId: string
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    onChange({ avatarFile: file })
    if (file) {
      const url = URL.createObjectURL(file)
      setPreview(url)
    } else {
      setPreview(null)
    }
  }

  useEffect(() => {
    const username = data.username.trim()
    if (username.length < 3) { setUsernameStatus('idle'); return }
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Your profile</h2>
        <p className="text-gray-500 text-sm">Add a photo and choose your username.</p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 hover:border-green-400 transition-colors flex items-center justify-center overflow-hidden group"
        >
          {preview ? (
            <img src={preview} alt="Avatar preview" className="w-full h-full object-cover" />
          ) : (
            <Camera size={24} className="text-gray-400 group-hover:text-green-500 transition-colors" />
          )}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center">
            <Camera size={20} className="text-white" />
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <p className="text-xs text-gray-400">
          {preview ? 'Click to change photo' : 'Upload a profile photo (optional)'}
        </p>
      </div>

      {/* Username */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
          <input
            type="text"
            value={data.username}
            onChange={(e) => onChange({ username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
            placeholder="your_username"
            maxLength={20}
            className="w-full pl-8 pr-10 py-2.5 rounded-xl border border-gray-200 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {usernameStatus === 'checking' && <Loader2 size={16} className="animate-spin text-gray-400" />}
            {usernameStatus === 'available' && <Check size={16} className="text-green-500" />}
            {usernameStatus === 'taken' && <X size={16} className="text-red-500" />}
          </div>
        </div>
        <div className="mt-1.5 flex justify-between items-center">
          <p className="text-xs text-gray-400">Letters, numbers and underscores only</p>
          {usernameStatus === 'taken' && (
            <p className="text-xs text-red-500">Username is taken</p>
          )}
          {usernameStatus === 'available' && (
            <p className="text-xs text-green-600">Available!</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const SAVING_MESSAGES = [
  'Подвозим мячики...',
  'Натягиваем сетку...',
  'Подготавливаем корт...',
  'Шнуруем кеды...',
  'Проверяем погоду...',
  'Составляем расписание...',
  'Подбираем соперников...',
  'Освежаем разметку...',
  'Почти готово...',
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingMsg, setSavingMsg] = useState(SAVING_MESSAGES[0])
  const [userId, setUserId] = useState('')

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/sign-in'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('skill_level_self, username')
        .eq('id', session.user.id)
        .single()

      if (profile?.skill_level_self) { router.replace('/search'); return }

      setUserId(session.user.id)
      if (profile?.username) {
        setData((prev) => ({ ...prev, username: profile.username }))
      }
      setLoading(false)
    }
    checkAuth()
  }, [router])

  function updateData(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }))
  }

  function canProceed() {
    if (step === 1) return data.city.trim().length > 0
    if (step === 2) return data.skillLevel !== null && data.playFormats.length > 0
    if (step === 3) return data.preferredDays.length > 0
    if (step === 5) return data.username.trim().length >= 3
    return true
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) {
      setStep(step + 1)
      return
    }
    // Final step — save everything
    setSaving(true)
    setSavingMsg(SAVING_MESSAGES[0])
    let msgIndex = 0
    const msgInterval = setInterval(() => {
      msgIndex = (msgIndex + 1) % SAVING_MESSAGES.length
      setSavingMsg(SAVING_MESSAGES[msgIndex])
    }, 800)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/sign-in'); return }

      // Upload avatar if selected
      let avatarUrl: string | null = null
      if (data.avatarFile) {
        const ext = data.avatarFile.name.split('.').pop()
        const path = `${session.user.id}/avatar.${ext}`
        const { data: upload } = await supabase.storage
          .from('avatars')
          .upload(path, data.avatarFile, { upsert: true })
        if (upload) {
          const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
          avatarUrl = publicUrl
        }
      }

      await supabase.from('profiles').update({
        neighborhood: data.neighborhood || null,
        skill_level_self: data.skillLevel,
        years_playing: data.yearsPlaying ? Math.round(data.yearsPlaying) : null,
        preferred_formats: data.playFormats,
        play_style: data.playStyle,
        preferred_surfaces: data.preferredSurfaces,
        preferred_days: data.preferredDays,
        preferred_time_start: data.preferredTimeStart,
        preferred_time_end: data.preferredTimeEnd,
        max_travel_km: data.maxTravelKm,
        bio: data.bio || null,
        looking_for: data.lookingFor || null,
        username: data.username.trim() || null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      }).eq('id', session.user.id)

      router.push('/search')
    } finally {
      clearInterval(msgInterval)
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar with progress */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="flex-1 flex gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i < step ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-gray-400 font-medium whitespace-nowrap">
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
          {step === 5 && <Step5 data={data} onChange={updateData} userId={userId} />}
        </div>
      </div>

      {/* Bottom action */}
      <div className="bg-white border-t border-gray-100 px-4 py-4 safe-area-pb">
        <div className="max-w-lg mx-auto space-y-2">
          <button
            onClick={handleNext}
            disabled={!canProceed() || saving}
            className="w-full py-3.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={16} className="animate-spin flex-shrink-0" /> : null}
            {saving ? savingMsg : step === TOTAL_STEPS ? 'Finish setup' : 'Continue'}
          </button>
          {step === TOTAL_STEPS && (
            <button
              onClick={() => router.push('/search')}
              className="w-full py-2.5 text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
