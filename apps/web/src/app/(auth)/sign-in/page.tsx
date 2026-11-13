'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { safeNext } from '@/lib/safe-next'
import { isGoogleAuthVisible } from '@/lib/google-auth'
import { GoogleContinueButton } from '@/components/auth/GoogleContinueButton'

function SignInForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'), '/search')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { data: signedIn, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email or password. Please try again.')
      } else if (error.message.includes('Email not confirmed')) {
        setError('Please verify your email address before signing in.')
      } else {
        setError(error.message)
      }
      setLoading(false)
      return
    }

    let destination = next
    if (signedIn.user && (next === '/search' || next === '/onboarding')) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_kind')
        .eq('id', signedIn.user.id)
        .maybeSingle()
      if (profile?.account_kind === 'court') destination = '/me'
    }

    router.push(destination)
  }

  return (
    <div className="bg-white rounded-[28px] p-8">
      <h1 className="font-display text-4xl tracking-wide text-center pl-[0.025em] mb-1">WELCOME BACK</h1>
      <p className="text-[10px] tracking-[0.15em] pl-[0.15em] uppercase text-center text-[rgba(26,26,26,0.4)] mb-6">Sign in to your account</p>

      {isGoogleAuthVisible() && <GoogleContinueButton nextPath={next} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-[#1a1a1a] placeholder-[rgba(26,26,26,0.4)] focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition-all text-sm"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)]">Password</label>
            <Link href="/forgot-password" className="text-xs text-brand-primary hover:text-brand-primary-dark font-medium">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
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
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] font-medium text-[10px] tracking-[0.2em] uppercase hover:bg-[#E8406A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : null}
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-[rgba(26,26,26,0.4)] mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="text-brand-primary font-medium hover:text-brand-primary-dark">
          Sign up
        </Link>
      </p>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-[28px] p-8">
        <div className="h-8 bg-brand-surface rounded w-1/2 mb-6 animate-pulse" />
        <div className="space-y-4">
          <div className="h-10 bg-brand-surface rounded animate-pulse" />
          <div className="h-10 bg-brand-surface rounded animate-pulse" />
          <div className="h-12 bg-brand-surface rounded animate-pulse" />
        </div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  )
}
