'use client'

import { useEffect } from 'react'

interface Props {
  cityName: string | null
  onDone: () => void
}

/** Brief confirmation after the global city changes. */
export function CityUpdatedToast({ cityName, onDone }: Props) {
  useEffect(() => {
    if (!cityName) return
    const timer = setTimeout(onDone, 2800)
    return () => clearTimeout(timer)
  }, [cityName, onDone])

  if (!cityName) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 md:bottom-8"
    >
      <p className="rounded-full bg-[#1a1a1a] px-4 py-2.5 text-[12px] font-medium text-[#FAF7F2] shadow-lg">
        Your city is now {cityName}
      </p>
    </div>
  )
}
