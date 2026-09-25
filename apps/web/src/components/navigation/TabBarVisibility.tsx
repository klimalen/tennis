'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

const TabBarHiddenContext = createContext<{
  hidden: boolean
  setHidden: (hidden: boolean) => void
  hold: () => () => void
}>({
  hidden: false,
  setHidden: () => {},
  hold: () => () => {},
})

export function TabBarVisibility({ children }: { children: ReactNode }) {
  const [forced, setForced] = useState(false)
  const [holds, setHolds] = useState(0)
  const setHidden = useCallback((value: boolean) => setForced(value), [])
  const hold = useCallback(() => {
    setHolds((count) => count + 1)
    return () => setHolds((count) => Math.max(0, count - 1))
  }, [])
  const hidden = forced || holds > 0
  const value = useMemo(() => ({ hidden, setHidden, hold }), [hidden, setHidden, hold])
  return <TabBarHiddenContext.Provider value={value}>{children}</TabBarHiddenContext.Provider>
}

export function useTabBarHidden() {
  return useContext(TabBarHiddenContext)
}

export function useHideTabBar(active: boolean) {
  const { hold } = useTabBarHidden()
  useEffect(() => {
    if (!active) return
    return hold()
  }, [active, hold])
}
