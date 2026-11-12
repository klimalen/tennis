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

type Panel = 'city' | 'search' | 'filters' | null

const controlIdle =
  'h-9 shrink-0 border border-[#1a1a1a]/15 bg-white text-[#1a1a1a] transition-colors hover:bg-brand-field'
const controlActive = 'h-9 shrink-0 border border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F2] transition-colors'
const controlAccent =
  'h-9 shrink-0 border border-[#E8748A] bg-[#E8748A] text-[#1a1a1a] transition-colors'
const iconBtn = 'flex w-9 items-center justify-center rounded-[12px]'
const panelClass = 'rounded-[20px] border border-[#1a1a1a]/10 bg-white p-3 space-y-2'
/** Match CityInput field chrome so search/city panels feel like one system */
const fieldClass =
  'w-full rounded-lg border border-[#1a1a1a]/40 bg-brand-field py-2.5 pl-8 pr-8 text-sm text-[#1a1a1a] outline-none placeholder:text-[rgba(26,26,26,0.4)] focus:border-brand-primary'

/**
 * Compact section chrome for PLAYERS / COURTS / OPEN GAMES:
 * back · title · city · search · filter on one row.
 * City / search / filters all open the same style of panel under the row.
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
  const [panel, setPanel] = useState<Panel>(() => (search?.value.trim() ? 'search' : null))
  const [cityError, setCityError] = useState<string | null>(null)
  const [citySaving, setCitySaving] = useState(false)

  useEffect(() => {
    if (search?.value.trim()) setPanel('search')
  }, [search?.value])

  function toggle(next: Panel) {
    setPanel((current) => (current === next ? null : next))
  }

  async function applyCity(location: ProfileLocation) {
    setCitySaving(true)
    setCityError(null)
    try {
      await onLocationChange(location)
      setPanel(null)
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

  const searchActive = Boolean(search?.value.trim())
  const cityLabel = cityName?.trim() || 'City'

  return (
    <div className="page-header max-w-full !py-3">
      <div className="mx-auto flex min-w-0 max-w-2xl flex-col gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onBack}
            className={`${iconBtn} ${controlIdle} !rounded-full`}
            aria-label="Back"
          >
            <ChevronLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </button>

          <span className="min-w-0 flex-1 truncate font-display text-2xl tracking-wide text-[#1a1a1a]">
            {title}
          </span>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setCityError(null)
                toggle('city')
              }}
              className={`inline-flex max-w-[9.5rem] items-center gap-1 rounded-[12px] px-2.5 text-[10px] font-medium uppercase tracking-[0.08em] ${
                panel === 'city' ? controlActive : controlIdle
              }`}
              aria-expanded={panel === 'city'}
            >
              <MapPin size={12} className={`shrink-0 ${panel === 'city' ? 'text-[#FAF7F2]' : 'text-brand-primary'}`} />
              <span className="min-w-0 truncate">{cityLabel}</span>
              <ChevronDown
                size={12}
                className={`shrink-0 opacity-50 transition-transform ${panel === 'city' ? 'rotate-180' : ''}`}
              />
            </button>
            {search && (
              <button
                type="button"
                onClick={() => toggle('search')}
                className={`${iconBtn} ${panel === 'search' || searchActive ? controlActive : controlIdle}`}
                aria-expanded={panel === 'search'}
                aria-label="Search"
              >
                <Search size={15} />
              </button>
            )}
            {filterPanel != null && (
              <button
                type="button"
                onClick={() => toggle('filters')}
                className={`relative ${iconBtn} ${
                  panel === 'filters' || filtersActive ? controlAccent : controlIdle
                }`}
                aria-expanded={panel === 'filters'}
                aria-label="Filters"
              >
                <ListFilter size={15} />
                {filtersActive && panel !== 'filters' && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#1a1a1a]" />
                )}
              </button>
            )}
          </div>
        </div>

        {panel === 'city' && (
          <div className={panelClass}>
            <CityInput value="" onChange={handleCityPick} placeholder="Search your city..." />
            <UseMyLocationButton
              disabled={citySaving}
              onDetected={(location) => void applyCity(location)}
              onError={setCityError}
            />
            {cityError && <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{cityError}</p>}
          </div>
        )}

        {panel === 'search' && search && (
          <div className={panelClass}>
            <div className="relative">
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
                className={fieldClass}
              />
              {search.value && (
                <button
                  type="button"
                  onClick={() => search.onChange('')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[rgba(26,26,26,0.45)] hover:bg-white"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {panel === 'filters' && filterPanel != null && (
          <div className={panelClass}>{filterPanel}</div>
        )}
      </div>
    </div>
  )
}
