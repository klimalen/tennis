'use client'

import { useState, useEffect, useRef } from 'react'
import { MapPin, X } from 'lucide-react'

interface NominatimPlace {
  place_id: number
  name: string
  display_name: string
  address?: { country?: string; state?: string }
  class?: string
  type?: string
}

interface Props {
  value: string
  onChange: (city: string) => void
  placeholder?: string
  className?: string
}

export function CityInput({ value, onChange, placeholder = 'Your city...', className = '' }: Props) {
  const [input, setInput] = useState(value)
  const [suggestions, setSuggestions] = useState<NominatimPlace[]>([])
  const [loading, setLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const skipRef = useRef(false)

  // Sync external value changes
  useEffect(() => {
    if (!skipRef.current) setInput(value)
  }, [value])

  // Debounced autocomplete
  useEffect(() => {
    if (skipRef.current) { skipRef.current = false; return }
    const q = input.trim()
    if (q.length < 2) { setSuggestions([]); setShowSuggestions(false); return }
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
    skipRef.current = true
    const city = place.name
    setInput(city)
    onChange(city)
    setSuggestions([])
    setShowSuggestions(false)
  }

  function clear() {
    setInput('')
    onChange('')
    setSuggestions([])
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative flex items-center">
        <MapPin size={14} className="absolute left-3 text-[rgba(26,26,26,0.35)] pointer-events-none" />
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true) }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder={placeholder}
          className="w-full pl-8 pr-8 py-2.5 bg-brand-surface border border-brand-divider text-sm outline-none focus:border-brand-primary placeholder:text-[rgba(26,26,26,0.35)]"
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
