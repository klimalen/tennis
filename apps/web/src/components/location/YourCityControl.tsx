'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { CityInput, type CityCoords } from '@/components/ui/CityInput'
import { UseMyLocationButton } from '@/components/location/UseMyLocationButton'
import type { ProfileLocation } from '@/lib/profile-location'

interface Props {
  cityName: string | null
  onLocationChange: (location: ProfileLocation) => void | Promise<void>
}

/**
 * Same city chip everywhere: tap to change (search + one-shot GPS).
 * Caller writes the profile / session city.
 */
export function YourCityControl({ cityName, onLocationChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function apply(location: ProfileLocation) {
    setSaving(true)
    setError(null)
    try {
      await onLocationChange(location)
      setEditing(false)
    } catch {
      setError('Could not update your city. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleCityPick(city: string, coords?: CityCoords) {
    if (!city.trim() || coords?.lat == null || coords.lng == null) return
    void apply({ name: city.trim(), lat: coords.lat, lng: coords.lng })
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => {
          setError(null)
          setEditing((open) => !open)
        }}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase text-[#1a1a1a] border border-[#1a1a1a]/10"
        aria-expanded={editing}
      >
        <MapPin size={12} className="shrink-0 text-brand-primary" />
        <span className="truncate font-medium">
          {cityName?.trim() || 'Add your city'}
        </span>
      </button>

      {editing && (
        <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 p-3 space-y-2">
          <CityInput
            value=""
            onChange={handleCityPick}
            placeholder="Search your city..."
          />
          <UseMyLocationButton
            disabled={saving}
            onDetected={(location) => void apply(location)}
            onError={setError}
          />
          {error && <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{error}</p>}
        </div>
      )}
    </div>
  )
}
