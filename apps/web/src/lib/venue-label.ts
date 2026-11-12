export const VENUE_KIND_LABELS: Record<string, string> = {
  public_park: 'Public park',
  tennis_center: 'Tennis center',
  club: 'Club',
  school: 'School',
  residential: 'Private community',
  hotel: 'Hotel / resort',
  commercial: 'Commercial',
  other: 'Facility',
  unknown: 'Tennis courts',
}

export function venueKindLabel(kind: string): string {
  return VENUE_KIND_LABELS[kind] ?? 'Tennis courts'
}

export function courtTitle(name: string | null | undefined, address: string | null | undefined): string {
  const trimmed = name?.trim() || 'Tennis courts'
  if (/^tennis courts?$/i.test(trimmed) && address?.trim()) return address.trim()
  return trimmed
}
