import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PUSH_TITLES, pushBodyFor, pushPathFor } from '@/lib/push/copy'

type NotificationRecord = {
  id: string
  user_id: string
  actor_id: string | null
  kind: string
  game_id: string | null
  payload: Record<string, unknown> | null
}

type WebhookBody = {
  type?: string
  table?: string
  record?: NotificationRecord
}

function authorized(request: Request): boolean {
  const secret = process.env['PUSH_WEBHOOK_SECRET']
  if (!secret) return true
  const header = request.headers.get('x-push-secret') ?? request.headers.get('authorization')
  return header === secret || header === `Bearer ${secret}`
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: WebhookBody
  try {
    body = await request.json() as WebhookBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const record = body.record
  if (!record?.user_id || !record.kind) {
    return NextResponse.json({ ok: true, skipped: 'no record' })
  }

  let admin
  try {
    admin = createAdminClient()
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Admin client missing' },
      { status: 500 },
    )
  }

  const { data: enabled, error: enabledError } = await admin.rpc('notification_kind_enabled', {
    p_user_id: record.user_id,
    p_kind: record.kind,
  })
  if (enabledError) {
    return NextResponse.json({ error: enabledError.message }, { status: 500 })
  }
  if (enabled === false) {
    return NextResponse.json({ ok: true, skipped: 'preference off' })
  }

  const [{ data: tokens }, actorResult] = await Promise.all([
    admin.from('push_tokens').select('token').eq('user_id', record.user_id),
    record.actor_id
      ? admin.from('profiles').select('full_name, username').eq('id', record.actor_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string; username: string } | null }),
  ])

  if (!tokens?.length) {
    return NextResponse.json({ ok: true, skipped: 'no tokens' })
  }

  const actorName = actorResult.data?.full_name?.trim() || 'Someone'
  const title = PUSH_TITLES[record.kind] ?? 'GAME.'
  const pushBody = pushBodyFor(record.kind, actorName, record.payload)
  const path = pushPathFor(record.kind, record.game_id, record.payload, actorResult.data?.username)

  const messages = tokens.map((row) => ({
    to: row.token,
    title,
    body: pushBody,
    sound: 'default' as const,
    data: {
      path,
      kind: record.kind,
      notification_id: record.id,
      conversation_id: record.payload?.['conversation_id'] ?? null,
      game_id: record.game_id,
    },
  }))

  const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  })
  const expoJson = await expoRes.json().catch(() => null) as {
    data?: Array<{ status?: string; details?: { error?: string } }>
  } | null

  if (!expoRes.ok) {
    return NextResponse.json({ error: 'Expo push failed', detail: expoJson }, { status: 502 })
  }

  const tickets = Array.isArray(expoJson?.data) ? expoJson.data : []
  const stale: string[] = []
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i]
    if (ticket?.status === 'error' && ticket?.details?.error === 'DeviceNotRegistered') {
      stale.push(tokens[i]!.token)
    }
  }
  if (stale.length) {
    await admin.from('push_tokens').delete().in('token', stale)
  }

  return NextResponse.json({ ok: true, sent: messages.length, stale: stale.length })
}
