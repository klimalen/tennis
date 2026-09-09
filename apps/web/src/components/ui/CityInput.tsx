'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, X } from 'lucide-react'

interface NominatimPlace {
  place_id: number
  name: string
  display_name: string
  lat?: string
  lon?: string
  address?: { country?: string; state?: string }
  class?: string
  type?: string
}

export interface CityCoords {
  lat: number
  lng: number
}

interface Props {
  value: string
  onChange: (city: string, coords?: CityCoords) => void
  placeholder?: string
  className?: string
}

export function CityInput({ value, onChange, placeholder = 'Your city...', className = '' }: Props) {
  const [input, setInput] = useState(value)
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Tracks whether the current input value was confirmed via dropdown selection
  const confirmedRef = useRef(true)
  // Tracks the last value that was confirmed (either from prop or dropdown)
  const lastConfirmedRef = useRef(value)
  // Prevents autocomplete fetch on external value sync
  const skipFetchRef = useRef(false)

  // Sync external value changes (e.g. initial load, reset)
  useEffect(() => {
    skipFetchRef.current = true
    confirmedRef.current = true
    lastConfirmedRef.current = value
    setInput(value)
    setSuggestions([])
    setShowSuggestions(false)
  }, [value])

  // Debounced autocomplete — only runs when user typed (not on external sync)
  useEffect(() => {
    if (skipFetchRef.current) {
      skipFetchRef.current = false
      return
    }
    const q = input.trim()
    if (q.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } },
        )
        const results = (await res.json()) as NominatimPlace[]
        const places = results.filter((r) => r.class === 'place' || r.class === 'boundary')
        setSuggestions((places.length ? places : results).slice(0, 5))
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [input])

  function select(place: NominatimPlace) {
    const city = place.name
    confirmedRef.current = true
    lastConfirmedRef.current = city
    skipFetchRef.current = true
    setInput(city)
    const coords: CityCoords | undefined =
      place.lat && place.lon
        ? { lat: parseFloat(place.lat), lng: parseFloat(place.lon) }
        : undefined
    onChange(city, coords)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    confirmedRef.current = false
    setInput(e.target.value)
    setShowSuggestions(true)
  }

  function handleBlur() {
    // If user typed something but never selected from dropdown — revert to last confirmed value
    setTimeout(() => {
      setShowSuggestions(false)
      if (!confirmedRef.current) {
        skipFetchRef.current = true
        setInput(lastConfirmedRef.current)
        setSuggestions([])
      }
    }, 150)
  }

  function clear() {
    confirmedRef.current = true
    lastConfirmedRef.current = ''
    skipFetchRef.current = true
    setInput('')
    onChange('')
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <MapPin size={14} className="absolute left-3 text-[rgba(26,26,26,0.35)] pointer-events-none" />
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={() => suggestions.length > 0 && showSuggestions && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-2.5 bg-white border border-brand-divider text-sm outline-none focus:border-brand-primary placeholder:text-[rgba(26,26,26,0.35)]"
        />
        {loading && (
          <div className="absolute right-3 w-3.5 h-3.5 border-2 border-brand-surface-md border-t-brand-primary rounded-full animate-spin" />
        )}
        {!loading && input && (
          <button onClick={clear} className="absolute right-3 text-[rgba(26,26,26,0.35)] hover:text-[#1a1a1a]">
            <X size={14} />
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-brand-divider shadow-sm mt-0.5">
          {suggestions.map((place) => {
            const country = place.address?.country
            const sub = [place.address?.state, country].filter(Boolean).join(', ')
            return (
              <button
                key={place.place_id}
                onMouseDown={() => select(place)}
                className="w-full text-left px-4 py-2.5 hover:bg-brand-surface transition-colors border-b border-brand-divider last:border-0"
              >
                <p className="text-sm text-[#1a1a1a]">{place.name}</p>
                {sub && sub !== place.name && (
                  <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">{sub}</p>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
