/**
 * Format a follower count LinkedIn-style:
 *  < 1 000          → exact number
 *  1 000 – 9 999    → floor to 500-step + "+" (e.g. 1 500+)
 *  ≥ 10 000         → floor to 5 000-step + "+" (e.g. 10 000+)
 */
export function formatFollowers(n: number): string {
  if (n < 1_000) return String(n)
  if (n < 10_000) {
    const step = Math.floor(n / 500) * 500
    return `${step.toLocaleString('en')}+`
  }
  const step = Math.floor(n / 5_000) * 5_000
  return `${step.toLocaleString('en')}+`
}
