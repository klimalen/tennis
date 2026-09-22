/** Word labels aligned with onboarding presets: 1.5, 2.5, 4.0, 6.0. */
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
