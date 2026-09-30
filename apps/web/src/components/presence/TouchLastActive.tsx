'use client'

import { useEffect } from 'react'

const TOUCH_KEY = 'last_active_touch'
const TOUCH_GAP_MS = 15 * 60 * 1000

export function TouchLastActive() {
  useEffect(() => {
    const previous = Number(sessionStorage.getItem(TOUCH_KEY) || '0')
    if (Date.now() - previous < TOUCH_GAP_MS) return
    sessionStorage.setItem(TOUCH_KEY, String(Date.now()))
    void fetch('/api/last-active', { method: 'POST' })
  }, [])

  return null
}
