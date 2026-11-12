import { safeNext } from '@/lib/safe-next'

/** Attach a same-origin return path (e.g. `/game/:id`) for in-app Back. */
export function withReturnTo(href: string, returnTo: string) {
  const url = new URL(href, 'http://local')
  url.searchParams.set('from', returnTo)
  return `${url.pathname}${url.search}`
}

export function returnToFromSearch(
  from: string | string[] | undefined,
  fallback = '/search',
) {
  const raw = Array.isArray(from) ? from[0] : from
  return safeNext(raw, fallback)
}
