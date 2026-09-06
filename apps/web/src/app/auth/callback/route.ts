import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/onboarding'

  if (code) {
    // We need to build the response before knowing the redirect target,
    // because cookies must be set on the same response object.
    // Use a temporary redirect, then swap it below.
    const response = NextResponse.redirect(`${origin}/onboarding`)

    const supabase = createServerClient(
      process.env['NEXT_PUBLIC_SUPABASE_URL']!,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options)
            })
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)

    // Check if the user has completed onboarding
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('skill_level_self')
        .eq('id', user.id)
        .single()

      // New user or incomplete profile → onboarding, otherwise honour `next`
      const destination = profile?.skill_level_self ? next : '/onboarding'
      response.headers.set('location', `${origin}${destination}`)
    }

    return response
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`)
}
