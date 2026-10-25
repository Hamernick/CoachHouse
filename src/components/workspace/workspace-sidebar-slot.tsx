"use client"

import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

const WorkspaceSidebarContext = createContext<{
  target: HTMLDivElement | null
  setTarget: (target: HTMLDivElement | null) => void
} | null>(null)

export function WorkspaceSidebarProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLDivElement | null>(null)
  const value = useMemo(() => ({ target, setTarget }), [target])
  return <WorkspaceSidebarContext.Provider value={value}>{children}</WorkspaceSidebarContext.Provider>
}

export function WorkspaceSidebarSlot() {
  const context = useContext(WorkspaceSidebarContext)
  return <div ref={context?.setTarget} data-workspace-sidebar-slot className="empty:hidden" />
}

// Only navigation moves into the shell; panel state and content stay canvas-owned.
export function WorkspaceSidebarPortal({ children }: { children: ReactNode }) {
  const context = useContext(WorkspaceSidebarContext)
  return context?.target ? createPortal(children, context.target) : null
}
