/** Merge linked court-profile fields onto a catalog venue card for display.
 * Profile wins when the value is present; empty profile fields keep catalog. */

export type LinkedCourtProfile = {
  username: string
  full_name?: string | null
  phone: string | null
  website: string | null
  bio: string | null
  address: string | null
  opening_hours: string | null
  account_kind: string
  city_name?: string | null
  court_count?: number | null
  preferred_surfaces?: string[] | null
  has_indoor?: boolean | null
  has_outdoor?: boolean | null
  lit?: boolean | null
  fee_hour_min?: number | null
  fee_hour_max?: number | null
}

export type VenueDisplayBase = {
  name: string
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  description: string | null
  court_count: number | null
  surface: string | null
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  fee: boolean | null
  fee_hour_min?: number | null
  fee_hour_max?: number | null
  surfaces?: string[] | null
  city_name?: string | null
  profile_username?: string | null
  court_verified?: boolean
}

function pickText(profile: string | null | undefined, catalog: string | null | undefined): string | null {
  const next = profile?.trim()
  if (next) return next
  const prev = catalog?.trim()
  return prev || null
}

function asFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const next = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(next) ? next : null
}

function pickNumber(
  profile: number | string | null | undefined,
  catalog: number | string | null | undefined,
): number | null {
  return asFiniteNumber(profile) ?? asFiniteNumber(catalog)
}

function pickBool(profile: boolean | null | undefined, catalog: boolean | null | undefined): boolean | null {
  if (profile !== null && profile !== undefined) return profile
  if (catalog !== null && catalog !== undefined) return catalog
  return null
}

export function mergeVenueDisplay<T extends VenueDisplayBase>(
  catalog: T,
  linked: LinkedCourtProfile | null | undefined,
): T & {
  surfaces: string[]
  fee_hour_min: number | null
  fee_hour_max: number | null
  city_name: string | null
  profile_username: string | null
  court_verified: boolean
} {
  const court = linked?.account_kind === 'court' ? linked : null
  const profileSurfaces = (court?.preferred_surfaces ?? []).filter(Boolean)
  const surfaces = profileSurfaces.length > 0
    ? profileSurfaces
    : catalog.surfaces?.length
      ? catalog.surfaces
      : catalog.surface
        ? [catalog.surface]
        : []

  const feeHourMin = pickNumber(court?.fee_hour_min, catalog.fee_hour_min ?? null)
  const feeHourMax = pickNumber(court?.fee_hour_max, catalog.fee_hour_max ?? null)
  const fee = feeHourMin != null || feeHourMax != null
    ? true
    : pickBool(undefined, catalog.fee)

  return {
    ...catalog,
    name: pickText(court?.full_name, catalog.name) ?? catalog.name,
    address: pickText(court?.address, catalog.address),
    phone: pickText(court?.phone, catalog.phone),
    website: pickText(court?.website, catalog.website),
    opening_hours: pickText(court?.opening_hours, catalog.opening_hours),
    description: pickText(court?.bio, catalog.description),
    court_count: pickNumber(court?.court_count, catalog.court_count),
    surface: surfaces[0] ?? catalog.surface,
    surfaces,
    lit: pickBool(court?.lit, catalog.lit),
    has_indoor: pickBool(court?.has_indoor, catalog.has_indoor),
    has_outdoor: pickBool(court?.has_outdoor, catalog.has_outdoor),
    fee,
    fee_hour_min: feeHourMin,
    fee_hour_max: feeHourMax,
    city_name: pickText(court?.city_name, catalog.city_name ?? null),
    profile_username: court?.username ?? catalog.profile_username ?? null,
    court_verified: Boolean(court?.username),
  }
}
