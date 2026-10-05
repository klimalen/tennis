'use client'

import { useEffect } from 'react'
import { isNativeGameApp } from '@/lib/native-app'

export function PwaRegister() {
  useEffect(() => {
    if (isNativeGameApp()) {
      document.documentElement.classList.add('game-native')
      return
    }
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  }, [])
  return null
}
