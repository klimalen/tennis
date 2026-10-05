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

  function redirectKeepingSession(url: URL) {
    const redirectResponse = NextResponse.redirect(url)
    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
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
