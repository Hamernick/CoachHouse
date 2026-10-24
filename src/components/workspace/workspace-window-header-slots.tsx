"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { createPortal } from "react-dom"

type HeaderTargets = {
  enabled: boolean
  actions: HTMLDivElement | null
  accessory: HTMLDivElement | null
  title?: HTMLDivElement | null
}
const HeaderContext = createContext<HeaderTargets | null>(null)
const ActiveContext = createContext(true)

export const WORKSPACE_HEADER_BUTTON =
  "h-7 shrink-0 rounded-full px-2.5 text-xs [@media(pointer:coarse)]:h-11"

export function WorkspaceWindowHeaderProvider({
  children,
  enabled,
  actions,
  accessory,
  title = null,
}: HeaderTargets & { children: ReactNode }) {
  const value = useMemo(
    () => ({ enabled, actions, accessory, title }),
    [enabled, actions, accessory, title]
  )
  return (
    <HeaderContext.Provider value={value}>{children}</HeaderContext.Provider>
  )
}

export function WorkspaceWindowHeaderScope({
  active,
  children,
}: {
  active: boolean
  children: ReactNode
}) {
  const parentActive = useContext(ActiveContext)
  return (
    <ActiveContext.Provider value={parentActive && active}>
      {children}
    </ActiveContext.Provider>
  )
}

export function useWorkspaceWindowHeader() {
  return Boolean(useContext(HeaderContext)?.enabled)
}

export function useWorkspaceWindowHeaderActive() {
  return useContext(ActiveContext)
}

/** Keep actions with their state owner; only their DOM moves into the window header. */
export function WorkspaceWindowHeaderPortal({
  children,
  slot = "actions",
}: {
  children: ReactNode
  slot?: "actions" | "accessory" | "title"
}) {
  const header = useContext(HeaderContext)
  const active = useContext(ActiveContext)
  if (!header?.enabled) return children
  if (!active || !header[slot]) return null
  return createPortal(children, header[slot])
}
