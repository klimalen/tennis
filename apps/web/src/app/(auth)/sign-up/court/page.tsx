'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CityInput, type CityCoords } from '@/components/ui/CityInput'

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm'

export default function CourtSignUpPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [coords, setCoords] = useState<CityCoords | null>(null)
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [description, setDescription] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  const passwordValid = password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordValid || !city.trim()) return
    setError(null)
    setAccountExists(false)
    setLoading(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          account_kind: 'court',
          full_name: name.trim(),
          city_name: city.trim(),
          city_lat: coords ? String(coords.lat) : '',
          city_lng: coords ? String(coords.lng) : '',
          phone: phone.trim(),
          website: website.trim(),
          bio: description.trim(),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/me`,
      },
    })

    if (signUpError) {
      if (signUpError.message.includes('already registered') || signUpError.message.includes('already been registered')) {
        setAccountExists(true)
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    if (!data.session) {
      setCheckEmail(true)
      setLoading(false)
      return
    }

    router.push('/me')
  }

  if (checkEmail) {
    return (
      <div className="bg-white border border-brand-divider p-8">
        <h1 className="font-display text-4xl tracking-wide mb-2">CHECK YOUR EMAIL</h1>
        <p className="text-sm text-[rgba(26,26,26,0.6)]">
          We sent a link to {email}. Open it to finish creating the court account, then sign in on the usual sign-in page.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-divider p-8">
      <h1 className="font-display text-4xl tracking-wide mb-1">COURT ACCOUNT</h1>
      <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)] mb-6">
        For a tennis center, club, or park
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
          <CityInput value={city} onChange={(next, nextCoords) => { setCity(next); setCoords(nextCoords ?? null) }} placeholder="Austin" />
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

        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setAccountExists(false) }}
            placeholder="courts@example.com"
            required
            autoComplete="email"
            className={inputClass}
          />
        </div>

        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              autoComplete="new-password"
              className={`${inputClass} pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.4)]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {accountExists && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded text-sm text-amber-700">
            This email is already registered. Sign in if it is already the court, or use a different email. One email cannot be both a player and a court.{' '}
            <Link href="/sign-in" className="font-semibold underline">Sign in</Link>
          </div>
        )}

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !name.trim() || !city.trim() || !email || !passwordValid}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Create court account'}
        </button>
      </form>

      <p className="text-center text-sm text-[rgba(26,26,26,0.4)] mt-6">
        Already registered this court?{' '}
        <Link href="/sign-in" className="text-brand-primary font-medium hover:text-brand-primary-dark">
          Sign in
        </Link>
      </p>
    </div>
  )
}
