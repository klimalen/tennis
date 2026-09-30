'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CityInput, type CityCoords } from '@/components/ui/CityInput'

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm'

export interface CourtDetailsValues {
  name: string
  city: string
  cityLat: number | null
  cityLng: number | null
  phone: string
  website: string
  description: string
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

export async function saveCourtDetails(values: CourtDetailsValues): Promise<string | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'Sign in to save these details.'

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, account_kind')
    .eq('id', user.id)
    .single()
  if (profile?.account_kind !== 'court') return 'This account is not a court.'

  const currentUsername = profile.username ?? ''
  const username = /^court\d*$/.test(currentUsername)
    ? await uniqueCourtUsername(values.name, user.id)
    : currentUsername

  const { error } = await supabase.from('profiles').update({
    full_name: values.name.trim(),
    username,
    city_name: values.city.trim(),
    city_lat: values.cityLat,
    city_lng: values.cityLng,
    phone: values.phone.trim() || null,
    website: values.website.trim() || null,
    bio: values.description.trim() || null,
  }).eq('id', user.id)

  return error ? error.message : null
}

export function CourtDetailsForm({
  initial,
  submitLabel,
  onSaved,
}: {
  initial?: Partial<CourtDetailsValues>
  submitLabel: string
  onSaved?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [coords, setCoords] = useState<CityCoords | null>(
    initial?.cityLat != null && initial?.cityLng != null
      ? { lat: initial.cityLat, lng: initial.cityLng }
      : null,
  )
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [website, setWebsite] = useState(initial?.website ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !city.trim() || loading) return
    setLoading(true)
    setError(null)
    const message = await saveCourtDetails({
      name,
      city,
      cityLat: coords?.lat ?? initial?.cityLat ?? null,
      cityLng: coords?.lng ?? initial?.cityLng ?? null,
      phone,
      website,
      description,
    })
    setLoading(false)
    if (message) {
      setError(message)
      return
    }
    onSaved?.()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-[rgba(26,26,26,0.55)]">
        You can change these details later.
      </p>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Court name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Caswell Tennis Center"
          required
          maxLength={80}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">City</label>
        <CityInput
          value={city}
          onChange={(next, nextCoords) => { setCity(next); setCoords(nextCoords ?? null) }}
          placeholder="Austin"
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Phone</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(512) 000-0000"
          maxLength={40}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Website</label>
        <input
          type="text"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          placeholder="https://"
          maxLength={300}
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Short description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Public courts, lessons, and open play."
          maxLength={600}
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-100 rounded text-sm text-red-600">{error}</div>
      )}
      <button
        type="submit"
        disabled={loading || !name.trim() || !city.trim()}
        className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
        {loading ? 'Saving...' : submitLabel}
      </button>
    </form>
  )
}

export function CourtDetailsContinue() {
  const router = useRouter()
  return (
    <CourtDetailsForm
      submitLabel="Save and continue"
      onSaved={() => router.refresh()}
    />
  )
}

export function CourtDetailsEditor({ initial }: { initial: CourtDetailsValues }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] tracking-[0.14em] uppercase font-medium text-[#1a1a1a] underline underline-offset-2"
      >
        Edit details
      </button>
    )
  }

  return (
    <div className="rounded-[28px] bg-white px-4 py-5">
      <CourtDetailsForm
        initial={initial}
        submitLabel="Save changes"
        onSaved={() => {
          setOpen(false)
          router.refresh()
        }}
      />
    </div>
  )
}
