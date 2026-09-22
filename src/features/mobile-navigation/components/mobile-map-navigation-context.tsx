"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react"

type MobileMapNavigation = {
  footer: HTMLElement | null
  setFooter: (element: HTMLElement | null) => void
  registerSearch: (action: (() => void) | null) => void
  openSearch: () => void
}

const MobileMapNavigationContext = createContext<MobileMapNavigation | null>(null)

export function MobileMapNavigationProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [footer, setFooter] = useState<HTMLElement | null>(null)
  const searchAction = useRef<(() => void) | null>(null)
  const registerSearch = useCallback((action: (() => void) | null) => {
    searchAction.current = action
  }, [])
  const openSearch = useCallback(() => searchAction.current?.(), [])
  const value = useMemo(() => ({ footer, setFooter, registerSearch, openSearch }), [footer, registerSearch, openSearch])
  return <MobileMapNavigationContext.Provider value={enabled ? value : null}>{children}</MobileMapNavigationContext.Provider>
}

export function useMobileMapNavigation() {
  return useContext(MobileMapNavigationContext)
}
