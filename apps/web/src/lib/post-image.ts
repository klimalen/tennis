/** Public post photo uploaded by this user into their own storage folder. */
export function ownPostImageUrl(url: string | null | undefined, userId: string): string | null {
  if (!url) return null
  const base = process.env['NEXT_PUBLIC_SUPABASE_URL']
  if (!base) return null

  let parsed: URL
  let expected: URL
  try {
    parsed = new URL(url)
    expected = new URL(base)
  } catch {
    return null
  }

  if (parsed.host !== expected.host) return null
  const marker = '/storage/v1/object/public/post-images/'
  const index = parsed.pathname.indexOf(marker)
  if (index === -1) return null

  const path = decodeURIComponent(parsed.pathname.slice(index + marker.length))
  if (!path.startsWith(`${userId}/`) || path.includes('..')) return null
  return `${expected.origin}${parsed.pathname}`
}
