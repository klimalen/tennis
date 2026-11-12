'use client'

import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { CityInput, type CityCoords } from '@/components/ui/CityInput'
import { UseMyLocationButton } from '@/components/location/UseMyLocationButton'
import type { ProfileLocation } from '@/lib/profile-location'

interface Props {
  cityName: string | null
  onLocationChange: (location: ProfileLocation) => void | Promise<void>
  /** Compact chip for Discover header. */
  variant?: 'block' | 'chip'
}

/**
 * Global “your city” control for Discover list screens.
 * Change / GPS update the app city (caller writes the profile).
 */
export function YourCityControl({ cityName, onLocationChange, variant = 'block' }: Props) {
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

  if (variant === 'chip') {
    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[11px] tracking-[0.08em] uppercase text-[#1a1a1a] border border-[#1a1a1a]/10"
        >
          <MapPin size={12} className="shrink-0 text-brand-primary" />
          <span className="truncate font-medium">
            {cityName?.trim() || 'Add your city'}
          </span>
        </button>
        {editing && (
          <div className="rounded-[20px] bg-white border border-[#1a1a1a]/10 p-3 space-y-2">
            <CityInput
              value={cityName ?? ''}
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-[#1a1a1a]">
          <MapPin size={14} className="shrink-0 text-brand-primary" />
          <span className="truncate">
            {cityName?.trim()
              ? <>Your city: <span className="font-medium">{cityName.trim()}</span></>
              : 'Add your city'}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setEditing((open) => !open)}
          className="text-[11px] tracking-[0.12em] uppercase font-medium text-brand-primary hover:underline"
        >
          {editing ? 'Cancel' : 'Change'}
        </button>
      </div>

      {editing && (
        <div className="space-y-2">
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
        </div>
      )}

      {!editing && (
        <UseMyLocationButton
          disabled={saving}
          onDetected={(location) => void apply(location)}
          onError={setError}
        />
      )}

      {error && <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{error}</p>}
    </div>
  )
}
