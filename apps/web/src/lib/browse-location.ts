import type { ProfileLocation } from '@/lib/profile-location'

const KEY = 'tennis.browseLocation'

/** Tab-session browse city for court accounts — never written to profiles. */
export function readBrowseLocation(): ProfileLocation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ProfileLocation>
    if (
      typeof parsed.name !== 'string'
      || !parsed.name.trim()
      || typeof parsed.lat !== 'number'
      || typeof parsed.lng !== 'number'
    ) {
      return null
    }
    return { name: parsed.name.trim(), lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

export function writeBrowseLocation(location: ProfileLocation) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({
      name: location.name.trim(),
      lat: location.lat,
      lng: location.lng,
    }))
  } catch {
    // private mode / quota — browse still works in memory for this visit
  }
}

export function clearBrowseLocation() {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
