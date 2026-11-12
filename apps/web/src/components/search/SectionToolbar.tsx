'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ListFilter, MapPin, Search, X } from 'lucide-react'
import { CityInput, type CityCoords } from '@/components/ui/CityInput'
import { UseMyLocationButton } from '@/components/location/UseMyLocationButton'
import type { ProfileLocation } from '@/lib/profile-location'

interface SearchConfig {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

interface Props {
  title: string
  onBack: () => void
  cityName: string | null
  onLocationChange: (location: ProfileLocation) => void | Promise<void>
  search?: SearchConfig | null
  filtersActive?: boolean
  filterPanel?: ReactNode
}

/**
 * Compact section chrome for PLAYERS / COURTS / OPEN GAMES:
 * back · title · city · search · filter on one row.
 * Search expands in-row; city + filter panels drop below.
 */
export function SectionToolbar({
  title,
  onBack,
  cityName,
  onLocationChange,
  search = null,
  filtersActive = false,
  filterPanel,
}: Props) {
  const [searchOpen, setSearchOpen] = useState(() => Boolean(search?.value.trim()))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [cityOpen, setCityOpen] = useState(false)
  const [cityError, setCityError] = useState<string | null>(null)
  const [citySaving, setCitySaving] = useState(false)

  useEffect(() => {
    if (search?.value.trim()) setSearchOpen(true)
  }, [search?.value])

  const searching = Boolean(search && searchOpen)

  async function applyCity(location: ProfileLocation) {
    setCitySaving(true)
    setCityError(null)
    try {
      await onLocationChange(location)
      setCityOpen(false)
    } catch {
      setCityError('Could not update your city. Please try again.')
    } finally {
      setCitySaving(false)
    }
  }

  function handleCityPick(city: string, coords?: CityCoords) {
    if (!city.trim() || coords?.lat == null || coords.lng == null) return
    void applyCity({ name: city.trim(), lat: coords.lat, lng: coords.lng })
  }

  return (
    <div className="page-header max-w-full !py-3">
      <div className="mx-auto flex min-w-0 max-w-2xl flex-col gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white transition-colors hover:bg-brand-field"
            aria-label="Back"
          >
            <ChevronLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>

          {searching && search ? (
            <div className="relative min-w-0 flex-1">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.35)]"
              />
              <input
                type="search"
                value={search.value}
                onChange={(e) => search.onChange(e.target.value)}
                placeholder={search.placeholder}
                autoFocus
                className="w-full rounded-full border border-[#1a1a1a]/40 bg-brand-field py-2 pl-8 pr-9 text-sm text-[#1a1a1a] outline-none placeholder:text-[rgba(26,26,26,0.4)] focus:border-brand-primary"
              />
              <button
                type="button"
                onClick={() => {
                  search.onChange('')
                  setSearchOpen(false)
                }}
                className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[rgba(26,26,26,0.45)] hover:bg-white"
                aria-label="Close search"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <span className="min-w-0 max-w-[38%] shrink truncate font-display text-2xl tracking-wide text-[#1a1a1a] sm:max-w-none">
                {title}
              </span>

              <button
                type="button"
                onClick={() => {
                  setFiltersOpen(false)
                  setCityError(null)
                  setCityOpen((open) => !open)
                }}
                className="inline-flex min-w-0 max-w-[42%] flex-1 items-center gap-1 rounded-full border border-[#1a1a1a]/10 bg-white px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#1a1a1a] sm:max-w-[12rem] sm:flex-none"
                aria-expanded={cityOpen}
              >
                <MapPin size={11} className="shrink-0 text-brand-primary" />
                <span className="truncate">{cityName?.trim() || 'Add city'}</span>
                <ChevronDown
                  size={12}
                  className={`shrink-0 text-[rgba(26,26,26,0.45)] transition-transform ${cityOpen ? 'rotate-180' : ''}`}
                />
              </button>

              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setCityOpen(false)
                      setFiltersOpen(false)
                      setSearchOpen(true)
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-[12px] border transition-colors ${
                      search.value.trim()
                        ? 'border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F2]'
                        : 'border-[#1a1a1a]/15 bg-white text-[#1a1a1a] hover:bg-brand-field'
                    }`}
                    aria-label="Search"
                  >
                    <Search size={15} />
                  </button>
                )}
                {filterPanel != null && (
                  <button
                    type="button"
                    onClick={() => {
                      setCityOpen(false)
                      setSearchOpen(false)
                      setFiltersOpen((open) => !open)
                    }}
                    className={`relative flex h-9 w-9 items-center justify-center rounded-[12px] border transition-colors ${
                      filtersOpen || filtersActive
                        ? 'border-[#E8748A] bg-[#E8748A] text-[#1a1a1a]'
                        : 'border-[#1a1a1a]/15 bg-white text-[#1a1a1a] hover:bg-brand-field'
                    }`}
                    aria-expanded={filtersOpen}
                    aria-label="Filters"
                  >
                    <ListFilter size={15} />
                    {filtersActive && !filtersOpen && (
                      <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {cityOpen && (
          <div className="rounded-[20px] border border-[#1a1a1a]/10 bg-white p-3 space-y-2">
            <CityInput value="" onChange={handleCityPick} placeholder="Search your city..." />
            <UseMyLocationButton
              disabled={citySaving}
              onDetected={(location) => void applyCity(location)}
              onError={setCityError}
            />
            {cityError && <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{cityError}</p>}
          </div>
        )}

        {filtersOpen && filterPanel != null && (
          <div className="rounded-[20px] border border-[#1a1a1a]/10 bg-white p-3 space-y-2">
            {filterPanel}
          </div>
        )}
      </div>
    </div>
  )
}
