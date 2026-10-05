'use client'

import { useEffect } from 'react'
import { isNativeGameApp } from '@/lib/native-app'

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (isNativeGameApp()) return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  }, [])
  return null
}
