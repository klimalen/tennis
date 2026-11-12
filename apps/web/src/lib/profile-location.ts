import type { SupabaseClient } from '@supabase/supabase-js'

export interface ProfileLocation {
  name: string
  lat: number
  lng: number
}

interface NominatimReverse {
  name?: string
  address?: {
    city?: string
    town?: string
    village?: string
    municipality?: string
    county?: string
    state?: string
  }
}

/** One-shot device fix — no watchPosition / continuous tracking. */
export function detectDeviceLocation(options?: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
      ...options,
    })
  })
}

export async function reverseGeocodeCity(lat: number, lng: number): Promise<ProfileLocation | null> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'en' } },
  )
  if (!res.ok) return null
  const result = (await res.json()) as NominatimReverse
  const name =
    result.address?.city
    ?? result.address?.town
    ?? result.address?.village
    ?? result.address?.municipality
    ?? result.address?.county
    ?? result.name
    ?? null
  if (!name?.trim()) return null
  return { name: name.trim(), lat, lng }
}

/** GPS once → city name + coordinates for the profile. */
export async function detectProfileLocation(): Promise<ProfileLocation> {
  const pos = await detectDeviceLocation()
  const { latitude, longitude } = pos.coords
  const place = await reverseGeocodeCity(latitude, longitude)
  if (place) return place
  // Fallback if reverse geocode has no city label — still usable as a search point.
  return { name: 'Your location', lat: latitude, lng: longitude }
}

export async function saveProfileCity(
  supabase: SupabaseClient,
  userId: string,
  location: ProfileLocation,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('profiles')
    .update({
      city_name: location.name,
      city_lat: location.lat,
      city_lng: location.lng,
    })
    .eq('id', userId)
  return { error: error?.message ?? null }
}
