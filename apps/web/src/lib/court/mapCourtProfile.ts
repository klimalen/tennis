import type { CourtDetailsValues } from '@/components/court/CourtDetailsForm'

/** Shared mapper — keep out of `'use client'` modules so Server Components can call it. */
export function mapCourtProfileToDetails(profile: {
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  city_name: string | null
  city_lat: number | null
  city_lng: number | null
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  court_count: number | null
  preferred_surfaces: string[] | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  lit: boolean | null
  fee_hour_min: number | null
  fee_hour_max: number | null
  whatsapp: string | null
  instagram: string | null
  telegram: string | null
  facebook: string | null
}): CourtDetailsValues {
  return {
    name: profile.full_name || '',
    username: profile.username || '',
    city: profile.city_name || '',
    cityLat: profile.city_lat ?? null,
    cityLng: profile.city_lng ?? null,
    address: profile.address || '',
    phone: profile.phone || '',
    website: profile.website || '',
    openingHours: profile.opening_hours || '',
    description: profile.bio || '',
    avatarUrl: profile.avatar_url || null,
    courtCount: profile.court_count != null ? String(profile.court_count) : '',
    surfaces: (profile.preferred_surfaces ?? []).filter((s: string) =>
      s === 'hard' || s === 'clay' || s === 'grass' || s === 'carpet' || s === 'synthetic',
    ),
    hasIndoor: profile.has_indoor ?? null,
    hasOutdoor: profile.has_outdoor ?? null,
    lit: profile.lit ?? null,
    feeHourMin: profile.fee_hour_min != null ? String(profile.fee_hour_min) : '',
    feeHourMax: profile.fee_hour_max != null ? String(profile.fee_hour_max) : '',
    whatsapp: profile.whatsapp || '',
    instagram: profile.instagram || '',
    telegram: profile.telegram || '',
    facebook: profile.facebook || '',
  }
}
