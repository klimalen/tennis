'use client'

import { useState } from 'react'
import { CityInput, type CityCoords } from '@/components/ui/CityInput'
import { UseMyLocationButton } from '@/components/location/UseMyLocationButton'
import type { ProfileLocation } from '@/lib/profile-location'

interface Props {
  value: string
  onChange: (city: string, coords?: CityCoords) => void
  helper?: string
  placeholder?: string
}

/** City autocomplete + one-shot GPS for profile / onboarding / ME edit. */
export function CityLocationField({
  value,
  onChange,
  helper = 'Used for courts, players, and games near you.',
  placeholder = 'Search your city...',
}: Props) {
  const [error, setError] = useState<string | null>(null)

  function applyLocation(location: ProfileLocation) {
    setError(null)
    onChange(location.name, { lat: location.lat, lng: location.lng })
  }

  return (
    <div>
      {helper && <p className="text-[11px] text-[rgba(26,26,26,0.45)] mb-2">{helper}</p>}
      <CityInput value={value} onChange={onChange} placeholder={placeholder} />
      <UseMyLocationButton
        className="mt-2"
        onDetected={applyLocation}
        onError={setError}
      />
      {error && <p className="mt-1.5 text-[11px] text-[rgba(26,26,26,0.5)]">{error}</p>}
    </div>
  )
}
