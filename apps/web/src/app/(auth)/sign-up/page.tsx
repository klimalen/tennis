'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )
}

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

  async function handleGoogleSignUp() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountExists, setAccountExists] = useState(false)

  const strength = getPasswordStrength(password)
  const passwordValid = password.length >= 8

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!passwordValid) return
    setError(null)
    setAccountExists(false)
    setLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already been registered')) {
        setAccountExists(true)
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    router.push('/onboarding')
  }

  return (
    <div className="bg-white border border-brand-divider p-8">
      <h1 className="font-display text-4xl tracking-wide mb-1">CREATE ACCOUNT</h1>
      <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)] mb-6">Join the tennis community</p>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogleSignUp}
        className="w-full flex items-center justify-center gap-3 py-2.5 border border-brand-divider rounded text-sm font-medium text-gray-700 hover:bg-brand-surface transition-colors mb-5"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="relative mb-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-brand-divider" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs text-[rgba(26,26,26,0.4)]">or</span>
        </div>
      </div>

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
            className="w-full px-4 py-2.5 rounded border border-brand-divider text-[#1a1a1a] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
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
            className="w-full px-4 py-2.5 rounded border border-brand-divider text-[#1a1a1a] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
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
              className="w-full px-4 py-2.5 pr-10 rounded border border-brand-divider text-[#1a1a1a] placeholder-[rgba(26,26,26,0.3)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
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
          className="w-full py-3 bg-brand-primary text-white font-medium text-[10px] tracking-[0.2em] uppercase rounded hover:bg-brand-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Creating account...' : 'Create account'}
        </button>

        <p className="text-xs text-[rgba(26,26,26,0.4)] text-center">
          By signing up you agree to our Terms of Service and Privacy Policy.
        </p>
      </form>

      <p className="text-center text-sm text-[rgba(26,26,26,0.4)] mt-6">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-brand-primary font-medium hover:text-brand-primary-dark">
          Sign in
        </Link>
      </p>
    </div>
  )
}
