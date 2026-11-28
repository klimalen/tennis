'use client'

import { useEffect } from 'react'

/** Client navigations do not always honor a hash, so scroll once the profile is on screen. */
export function ScrollToHash() {
  useEffect(() => {
    const id = window.location.hash.replace(/^#/, '')
    if (!id) return
    const node = document.getElementById(id)
    node?.scrollIntoView({ block: 'start' })
  }, [])
  return null
}
