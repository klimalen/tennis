'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/** Incomplete court profiles finish setup in the multi-step onboarding flow. */
export function CourtDetailsGate() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/onboarding/court')
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg">
      <Loader2 size={22} className="animate-spin text-[rgba(26,26,26,0.35)]" />
    </div>
  )
}
