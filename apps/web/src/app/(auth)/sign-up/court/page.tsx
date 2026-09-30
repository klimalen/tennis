'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CourtDetailsForm } from '@/components/court/CourtDetailsForm'

const inputClass = 'w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm'

export default function CourtSignUpPage() {
  const router = useRouter()
  const [step, setStep] = useState<'account' | 'details' | 'check-email'>('account')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const [signedInAsPlayer, setSignedInAsPlayer] = useState(false)

  const passwordValid = password.length >= 8

  useEffect(() => {
    let cancelled = false
    async function resume() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setReady(true)
        return
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_kind, full_name, city_name')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (profile?.account_kind === 'court') {
        if (!profile.full_name?.trim() || !profile.city_name?.trim()) {
          setStep('details')
        } else {
          router.replace('/me')
          return
        }
      } else if (profile) {
        setSignedInAsPlayer(true)
      }
      setReady(true)
    }
    void resume()
    return () => { cancelled = true }
  }, [router])

  async function handleAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordValid || !email.trim()) return
    setError(null)
    setAccountExists(false)
    setLoading(true)

    const supabase = createClient()
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { account_kind: 'court' },
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

    setLoading(false)
    if (!data.session) {
      setStep('check-email')
      return
    }
    setStep('details')
  }

  if (!ready) {
    return (
      <div className="bg-white border border-brand-divider p-8 flex justify-center">
        <Loader2 size={18} className="animate-spin text-[rgba(26,26,26,0.4)]" />
      </div>
    )
  }

  if (step === 'check-email') {
    return (
      <div className="bg-white border border-brand-divider p-8">
        <h1 className="font-display text-4xl tracking-wide mb-2">CHECK YOUR EMAIL</h1>
        <p className="text-sm text-[rgba(26,26,26,0.6)]">
          We sent a link to {email}. Open it, then sign in. The next screen asks for the court name and city. You can change those details later.
        </p>
      </div>
    )
  }

  if (step === 'details') {
    return (
      <div className="bg-white border border-brand-divider p-8">
        <h1 className="font-display text-4xl tracking-wide mb-1">ABOUT THE COURT</h1>
        <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)] mb-6">
          Name, city, and how players reach you
        </p>
        <CourtDetailsForm
          submitLabel="Save and continue"
          onSaved={() => router.push('/me')}
        />
      </div>
    )
  }

  return (
    <div className="bg-white border border-brand-divider p-8">
      <h1 className="font-display text-4xl tracking-wide mb-1">COURT ACCOUNT</h1>
      <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)] mb-6">
        Email and password. Court details come next.
      </p>

      <form onSubmit={handleAccount} className="space-y-4">
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

        {signedInAsPlayer && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded text-sm text-amber-700">
            This browser is signed in as a player. Sign out, then open this page again to register a court. One email cannot be both.
          </div>
        )}

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
          disabled={loading || signedInAsPlayer || !email.trim() || !passwordValid}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Continue'}
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
