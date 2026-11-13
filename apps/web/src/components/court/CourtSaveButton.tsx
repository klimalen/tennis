'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Star } from 'lucide-react'

export function CourtSaveButton({ venueId, signedIn }: { venueId: string; signedIn: boolean }) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let cancelled = false
    void fetch('/api/court-favorites')
      .then((response) => response.json())
      .then((body: { venues?: { id: string }[] }) => {
        if (!cancelled) setSaved((body.venues ?? []).some((venue) => venue.id === venueId))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [signedIn, venueId])

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(`/court/${venueId}`)}`}
        className="flex items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-white px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a] hover:bg-brand-field"
      >
        <Star size={13} /> Save to favorites
      </Link>
    )
  }

  async function toggle() {
    if (busy) return
    setBusy(true)
    const next = !saved
    setSaved(next)
    const response = await fetch('/api/court-favorites', {
      method: next ? 'POST' : 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ venue_group_id: venueId }),
    })
    if (!response.ok) setSaved(!next)
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={() => { void toggle() }}
      className="flex items-center justify-center gap-2 rounded-full border border-[#1a1a1a]/15 bg-white px-4 py-3 text-[10px] font-medium uppercase tracking-[0.2em] text-[#1a1a1a] hover:bg-brand-field"
    >
      <Star size={13} fill={saved ? '#E8748A' : 'none'} stroke={saved ? '#E8748A' : 'currentColor'} />
      {saved ? 'Saved to favorites' : 'Save to favorites'}
    </button>
  )
}
