'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, X } from 'lucide-react'
import { toPlaceSuggestions, type NominatimPlace, type PlaceSuggestion } from '@/lib/place-suggestions'

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
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
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
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=10&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } },
        )
        const results = (await res.json()) as NominatimPlace[]
        setSuggestions(toPlaceSuggestions(results))
        setShowSuggestions(true)
      } catch {
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [input])

  function select(row: PlaceSuggestion) {
    const place = row.place
    const city = row.title
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
          className="w-full pl-8 pr-8 py-2.5 bg-brand-field border border-[#1a1a1a]/40 rounded-lg text-sm text-[#1a1a1a] outline-none focus:border-brand-primary placeholder:text-[rgba(26,26,26,0.4)]"
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
        <div className="absolute top-full left-0 right-0 z-40 bg-white border border-[#1a1a1a]/15 rounded-lg shadow-sm mt-1 overflow-hidden">
          {suggestions.map((row) => (
            <button
              key={row.place.place_id}
              onMouseDown={() => select(row)}
              className="w-full text-left px-4 py-2.5 hover:bg-brand-surface transition-colors border-b border-brand-divider last:border-0"
            >
              <p className="text-sm text-[#1a1a1a]">{row.title}</p>
              {row.subtitle && row.subtitle !== row.title && (
                <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">{row.subtitle}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
