"use client"

import { createContext, useContext, useLayoutEffect } from "react"
import { useWorkspaceWindowHeaderActive } from "./workspace-window-header-slots"

const SizeContext = createContext<((width: number | undefined) => void) | null>(null)
export const WorkspaceWindowSizeProvider = SizeContext.Provider

/** A retained, inactive editor must never resize the visible window. */
export function useWorkspaceWindowPreferredWidth(width?: number) {
  const setWidth = useContext(SizeContext)
  const active = useWorkspaceWindowHeaderActive()
  useLayoutEffect(() => {
    if (!active || !setWidth) return
    setWidth(width)
    return () => setWidth(undefined)
  }, [active, setWidth, width])
}
