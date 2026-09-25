'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

const TabBarHiddenContext = createContext<{
  hidden: boolean
  setHidden: (hidden: boolean) => void
}>({
  hidden: false,
  setHidden: () => {},
})

export function TabBarVisibility({ children }: { children: ReactNode }) {
  const [hidden, setHiddenState] = useState(false)
  const setHidden = useCallback((value: boolean) => setHiddenState(value), [])
  const value = useMemo(() => ({ hidden, setHidden }), [hidden, setHidden])
  return <TabBarHiddenContext.Provider value={value}>{children}</TabBarHiddenContext.Provider>
}

export function useTabBarHidden() {
  return useContext(TabBarHiddenContext)
}
