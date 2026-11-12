import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip auth callback — middleware must not touch PKCE cookies before the route handler does
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  // Refresh session on every request — required for Supabase SSR auth to work correctly
  const supabase = createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()

  function redirectKeepingSession(url: URL, status = 307) {
    const redirectResponse = NextResponse.redirect(url, status)
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  // Old profile names and absorbed courts redirect before the page shell streams,
  // so the status is a real 308 rather than a client-side handoff.
  const profileMatch = pathname.match(/^\/profile\/([^/]+)(\/.*)?$/)
  const profileSlug = profileMatch?.[1]
  if (profileSlug) {
    const slug = decodeURIComponent(profileSlug)
    const { data: nextName } = await supabase.rpc('profile_slug_redirect', { slug })
    if (typeof nextName === 'string' && nextName && nextName !== slug) {
      const url = request.nextUrl.clone()
      url.pathname = `/profile/${encodeURIComponent(nextName)}${profileMatch[2] ?? ''}`
      return redirectKeepingSession(url, 308)
    }
  }

  const courtMatch = pathname.match(/^\/court\/([0-9a-f-]{36})$/i)
  const courtId = courtMatch?.[1]
  if (courtId) {
    const { data: redirectRow } = await supabase
      .from('venue_group_redirects')
      .select('new_id')
      .eq('old_id', courtId)
      .maybeSingle()
    const nextId = redirectRow?.new_id as string | undefined
    if (nextId && nextId !== courtId) {
      const url = request.nextUrl.clone()
      url.pathname = `/court/${nextId}`
      return redirectKeepingSession(url, 308)
    }
  }

  // Signed-in players should never see the public welcome or auth screens again.
  // The native app always opens `/`, so this is what restores the session on relaunch.
  if (user && (pathname === '/' || pathname === '/sign-in' || pathname === '/sign-up')) {
    const url = request.nextUrl.clone()
    url.pathname = '/search'
    url.search = ''
    return redirectKeepingSession(url)
  }

  // Protect routes that require auth
  const PROTECTED = ['/me/edit', '/create', '/schedule/book', '/settings', '/chats', '/games', '/feed/new']

  if (PROTECTED.some((r) => pathname.startsWith(r)) && !user) {
    const url = request.nextUrl.clone()
    const nextPath = `${pathname}${request.nextUrl.search}`
    url.pathname = '/sign-in'
    url.search = ''
    url.searchParams.set('next', nextPath)
    return redirectKeepingSession(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
