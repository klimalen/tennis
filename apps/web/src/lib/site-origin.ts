import { headers } from 'next/headers'

const PRODUCTION_ORIGIN = 'https://www.game-tennis.space'

/** Preview and local hosts keep their own origin so a shared link unfurls on the contour that served it. */
export async function siteOrigin(): Promise<string> {
  const headerList = await headers()
  const rawHost = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const host = rawHost?.split(',')[0]?.trim().toLowerCase() ?? ''
  const proto = headerList.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
  const allowed =
    host === 'www.game-tennis.space' ||
    host === 'game-tennis.space' ||
    host.endsWith('.vercel.app') ||
    host.startsWith('localhost:') ||
    host.startsWith('127.0.0.1:')
  if (!allowed) return PRODUCTION_ORIGIN
  return `${proto}://${host}`
}
