// Deno Edge Function: Database Webhook on public.notifications INSERT → Expo Push.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PUSH_WEBHOOK_SECRET (optional).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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
  schema?: string
}

const TITLES: Record<string, string> = {
  follow: 'New follower',
  request: 'Wants to play',
  request_accepted: 'Request accepted',
  request_declined: 'Request declined',
  game_invite: 'Game invite',
  game_joined: 'Player joined',
  game_left: 'Player left',
  game_updated: 'Game updated',
  game_cancelled: 'Game cancelled',
  message: 'New message',
}

function pathFor(record: NotificationRecord): string {
  const payload = record.payload ?? {}
  if (record.kind === 'message' && typeof payload['conversation_id'] === 'string') {
    return `/chats/${payload['conversation_id']}`
  }
  if (record.game_id) return `/games/${record.game_id}`
  return '/feed'
}

function bodyFor(kind: string, actorName: string, payload: Record<string, unknown> | null): string {
  const name = actorName || 'Someone'
  switch (kind) {
    case 'follow':
      return `${name} started following you`
    case 'request':
      return `${name} wants to play`
    case 'request_accepted':
      return `${name} accepted your request`
    case 'request_declined':
      return `${name} declined your request`
    case 'game_invite':
      return `${name} invited you to a game`
    case 'game_joined':
      return `${name} joined your game`
    case 'game_left':
      return `${name} left your game`
    case 'game_updated':
      return `${name} updated a game`
    case 'game_cancelled':
      return `${name} cancelled a game`
    case 'message': {
      const preview = typeof payload?.['preview'] === 'string' ? payload['preview'].trim() : ''
      return preview || `${name} sent you a message`
    }
    default:
      return `${name} sent an update`
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (secret) {
    const header = req.headers.get('x-push-secret') ?? req.headers.get('authorization')
    if (header !== secret && header !== `Bearer ${secret}`) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    return new Response('Missing Supabase env', { status: 500 })
  }

  let body: WebhookBody
  try {
    body = await req.json()
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }

  const record = body.record
  if (!record?.user_id || !record.kind) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no record' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: enabled, error: enabledError } = await admin.rpc('notification_kind_enabled', {
    p_user_id: record.user_id,
    p_kind: record.kind,
  })
  if (enabledError) {
    return new Response(JSON.stringify({ error: enabledError.message }), { status: 500 })
  }
  if (enabled === false) {
    return new Response(JSON.stringify({ ok: true, skipped: 'preference off' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const [{ data: tokens }, { data: actor }] = await Promise.all([
    admin.from('push_tokens').select('token').eq('user_id', record.user_id),
    record.actor_id
      ? admin.from('profiles').select('full_name').eq('id', record.actor_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  if (!tokens?.length) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no tokens' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const actorName = actor?.full_name?.trim() || 'Someone'
  const title = TITLES[record.kind] ?? 'GAME.'
  const pushBody = bodyFor(record.kind, actorName, record.payload)
  const path = pathFor(record)

  const messages = tokens.map((row) => ({
    to: row.token,
    title,
    body: pushBody,
    sound: 'default',
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

  const expoJson = await expoRes.json().catch(() => null)
  if (!expoRes.ok) {
    return new Response(JSON.stringify({ error: 'Expo push failed', detail: expoJson }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Drop tokens Expo says are gone.
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

  return new Response(JSON.stringify({ ok: true, sent: messages.length, stale: stale.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
