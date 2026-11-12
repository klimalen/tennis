'use client'

import { useState } from 'react'
import { Loader2, MapPin } from 'lucide-react'
import { detectProfileLocation, type ProfileLocation } from '@/lib/profile-location'

interface Props {
  onDetected: (location: ProfileLocation) => void | Promise<void>
  onError?: (message: string) => void
  className?: string
  disabled?: boolean
}

export function UseMyLocationButton({ onDetected, onError, className = '', disabled }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy || disabled) return
    setBusy(true)
    try {
      const location = await detectProfileLocation()
      await onDetected(location)
    } catch {
      onError?.('Could not detect your location. Allow location access and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => void handleClick()}
      disabled={busy || disabled}
      className={`flex items-center gap-1.5 text-[11px] text-brand-primary tracking-[0.1em] uppercase font-medium hover:underline disabled:opacity-40 ${className}`}
    >
      {busy ? (
        <>
          <Loader2 size={11} className="animate-spin" /> Detecting location...
        </>
      ) : (
        <>
          <MapPin size={11} /> Use my location
        </>
      )}
    </button>
  )
}
