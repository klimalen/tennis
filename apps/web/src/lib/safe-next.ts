/** A post-login path on this site. Rejects other origins and protocol-relative URLs. */
export function safeNext(value: string | null | undefined, fallback: string) {
  if (!value) return fallback
  if (!value.startsWith('/')) return fallback
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (value.includes('\\') || value.includes('\n') || value.includes('\r')) return fallback
  return value
}
