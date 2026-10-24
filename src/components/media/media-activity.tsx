"use client"

import { createContext, useContext, type ReactNode } from "react"

const MediaActivity = createContext(true)

// React context crosses lesson portals without relying on DOM ancestry.
export function MediaActivityProvider({
  active,
  children,
}: {
  active: boolean
  children?: ReactNode
}) {
  const parentActive = useContext(MediaActivity)
  return (
    <MediaActivity.Provider value={parentActive && active}>
      {children}
    </MediaActivity.Provider>
  )
}

export function useMediaActivity() {
  return useContext(MediaActivity)
}
