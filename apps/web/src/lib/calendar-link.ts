import { createHmac, timingSafeEqual } from 'crypto'

const TTL_SECONDS = 60 * 60 * 24

type CalendarLinkPayload = {
  g: string
  u: string
  e: number
}

function linkSecret(): string | null {
  const secret = process.env['SUPABASE_SERVICE_ROLE_KEY']
  return secret && secret.length > 0 ? secret : null
}

function encode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

/**
 * The phone app opens this address in the system browser, which does not have
 * the session. The signature lets that browser fetch this one event only.
 */
export function signCalendarLink(gameId: string, userId: string, now = Date.now()): string | null {
  const secret = linkSecret()
  if (!secret) return null
  const payload = encode(JSON.stringify({
    g: gameId,
    u: userId,
    e: Math.floor(now / 1000) + TTL_SECONDS,
  } satisfies CalendarLinkPayload))
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${sig}`
}

export function readCalendarLink(token: string, now = Date.now()): { gameId: string; userId: string } | null {
  const secret = linkSecret()
  if (!secret) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts
  if (!payload || !sig) return null
  const expected = createHmac('sha256', secret).update(payload).digest()
  let got: Buffer
  try {
    got = Buffer.from(sig, 'base64url')
  } catch {
    return null
  }
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null
  let body: CalendarLinkPayload
  try {
    body = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as CalendarLinkPayload
  } catch {
    return null
  }
  if (typeof body.g !== 'string' || typeof body.u !== 'string' || typeof body.e !== 'number') return null
  if (body.e < Math.floor(now / 1000)) return null
  return { gameId: body.g, userId: body.u }
}
