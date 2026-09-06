import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
  }

  // Collect cookies during session exchange, apply them to final response
  const pendingCookies: { name: string; value: string; options: Record<string, unknown> }[] = []

  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) =>
            pendingCookies.push({ name, value, options: options as Record<string, unknown> }),
          )
        },
      },
    },
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
  }

  // New user (no onboarding) → always send to /onboarding
  let destination = next
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('skill_level_self')
      .eq('id', user.id)
      .single()
    if (!profile?.skill_level_self) destination = '/onboarding'
  }

  const response = NextResponse.redirect(`${origin}${destination}`)
  pendingCookies.forEach(({ name, value }) => response.cookies.set(name, value))
  return response
}
