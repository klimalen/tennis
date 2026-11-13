/** Word labels aligned with onboarding presets: 1.5, 2.5, 4.0, 6.0. */
export const SKILL_OPTIONS = ['Beginner', 'Intermediate', 'Advanced', 'Competitive'] as const

export function skillLabel(level: number | null | undefined): string | null {
  if (level == null || Number.isNaN(level)) return null
  if (level < 2) return 'Beginner'
  if (level < 4) return 'Intermediate'
  if (level < 5.5) return 'Advanced'
  return 'Competitive'
}

export function formatPlayFormat(format: string | null | undefined): string {
  if (format === 'singles') return 'Singles'
  if (format === 'mixed_doubles') return 'Mixed'
  if (format === 'doubles') return 'Doubles'
  return format ?? ''
}

/**
 * Chip labels for profiles.play_style.
 * Wording stays distinct from skill tiers (Beginner…Competitive) and talks about
 * training intent (fun vs competition), not match outcomes ("to win").
 * `both` expands to both intents (never a vague "Both").
 */
export function playStyleLabels(style: string | null | undefined): string[] {
  if (style === 'recreational') return ['For fun']
  if (style === 'competitive') return ['For competition']
  if (style === 'both') return ['For fun', 'For competition']
  return []
}

/** Letter-avatar wash for game chats — keeps singles vs doubles visually distinct. */
export function gameChatAvatarClass(format: string | null | undefined): string {
  if (format === 'singles') return 'bg-[#D7EBE6]'
  if (format === 'mixed_doubles') return 'bg-[#E8DFEE]'
  if (format === 'doubles') return 'bg-[#F6D9DF]'
  return 'bg-[#E8E1D7]'
}
