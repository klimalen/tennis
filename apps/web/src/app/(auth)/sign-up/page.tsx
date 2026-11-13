'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isGoogleAuthVisible } from '@/lib/google-auth'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (password.length === 0) return { score: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 1) return { score, label: 'Weak', color: 'bg-red-400' }
  if (score === 2) return { score, label: 'Fair', color: 'bg-yellow-400' }
  if (score === 3) return { score, label: 'Good', color: 'bg-blue-400' }
  return { score, label: 'Strong', color: 'bg-green-500' }
}

export default function SignUpPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)
  const submittingRef = useRef(false)

  const strength = getPasswordStrength(password)
  const passwordValid = password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordValid || !fullName.trim() || !email.trim()) return
    // Guard before React re-renders disabled=loading — double-clicks can fire twice.
    if (submittingRef.current) return
    submittingRef.current = true
    setError(null)
    setAccountExists(false)
    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        if (
          signUpError.message.includes('already registered')
          || signUpError.message.includes('already been registered')
        ) {
          setAccountExists(true)
        } else {
          setError(signUpError.message)
        }
        submittingRef.current = false
        setLoading(false)
        return
      }

      if (!data.session) {
        setCheckEmail(true)
        setLoading(false)
        return
      }

      router.push('/onboarding')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create the account. Try again.')
      submittingRef.current = false
      setLoading(false)
    }
  }

  if (checkEmail) {
    return (
      <div className="bg-white rounded-[28px] p-8">
        <h1 className="font-display text-4xl tracking-wide mb-2">CHECK YOUR EMAIL</h1>
        <p className="text-sm text-[rgba(26,26,26,0.6)]">
          We sent a link to {email.trim()}. Open it to confirm your account, then continue setup.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-[28px] p-8">
      <h1 className="font-display text-4xl tracking-wide text-center pl-[0.025em] mb-1">CREATE ACCOUNT</h1>
      <p className="text-[10px] tracking-[0.15em] pl-[0.15em] uppercase text-center text-[rgba(26,26,26,0.4)] mb-6">Join the tennis community</p>

      {isGoogleAuthVisible() && <GoogleContinueButton />}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Full name */}
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Full name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Smith"
            required
            autoComplete="name"
            className="w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setAccountExists(false) }}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              autoComplete="new-password"
              className="w-full px-4 py-2.5 pr-10 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.4)] hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength indicator */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 transition-all ${
                      i <= strength.score ? strength.color : 'bg-brand-surface'
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-xs text-[rgba(26,26,26,0.4)]">
                  {passwordValid ? (
                    <Check size={12} className="text-green-500" />
                  ) : null}
                  <span>Min. 8 characters</span>
                </div>
                {strength.label && (
                  <span className="text-xs font-medium text-[rgba(26,26,26,0.4)]">{strength.label}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Account exists */}
        {accountExists && (
          <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded text-sm text-amber-700">
            An account with this email already exists.{' '}
            <Link href={`/sign-in?email=${encodeURIComponent(email)}`} className="font-semibold underline">
              Sign in instead?
            </Link>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !fullName || !email || !passwordValid}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Create account'}
        </button>

      </form>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-[rgba(26,26,26,0.5)]">
        By creating an account you confirm that you are at least 16 and agree to the{' '}
        <Link href="/terms" className="underline underline-offset-2 text-[#1a1a1a]">Terms of Use</Link>
        {' '}and the{' '}
        <Link href="/privacy" className="underline underline-offset-2 text-[#1a1a1a]">Privacy Policy</Link>.
      </p>

      <p className="text-center text-sm text-[rgba(26,26,26,0.4)] mt-6">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand-primary font-medium hover:text-brand-primary-dark">
          Sign in
        </Link>
      </p>
    </div>
  )
}
