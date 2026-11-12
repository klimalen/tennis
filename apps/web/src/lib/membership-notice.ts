export interface MembershipNotice {
  event: 'joined' | 'left'
  name: string
  scheduledAt: string | null
}

export function readMembershipNotice(body: string): MembershipNotice | null {
  try {
    const parsed = JSON.parse(body) as {
      event?: string
      name?: string
      scheduled_at?: string | null
    }
    if (parsed.event !== 'joined' && parsed.event !== 'left') return null
    const name = parsed.name?.trim() || 'Someone'
    return {
      event: parsed.event,
      name,
      scheduledAt: parsed.scheduled_at ?? null,
    }
  } catch {
    return null
  }
}

export function membershipNoticeText(body: string): string | null {
  const notice = readMembershipNotice(body)
  if (!notice) return null
  return notice.event === 'joined'
    ? `${notice.name} joined the game`
    : `${notice.name} left the game`
}
