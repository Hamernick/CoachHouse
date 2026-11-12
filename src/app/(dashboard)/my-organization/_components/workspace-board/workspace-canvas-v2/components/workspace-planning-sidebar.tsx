"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"
import { PlanningSidebarSurface } from "@/features/workspace-objectives/client"
import styles from "./workspace-dock.module.css"

/** Retain the planning tree and its drafts while organization occupies this surface. */
export function WorkspacePlanningSidebar({ header, children, hidden, restoreFocus = true }: {
  header: ReactNode
  children: ReactNode
  hidden: boolean
  restoreFocus?: boolean
}) {
  const home = useRef<HTMLDivElement>(null)
  const wasHidden = useRef(hidden)
  useLayoutEffect(() => {
    const returning = wasHidden.current && !hidden && restoreFocus
    wasHidden.current = hidden
    if (!returning) return
    const frame = requestAnimationFrame(() => home.current?.querySelector<HTMLButtonElement>("[data-workspace-organization-trigger]")?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [hidden, restoreFocus])
  return <div ref={home} data-workspace-sidebar-home aria-hidden={hidden} inert={hidden || undefined}
    className={`nodrag nopan nowheel ${styles.planningSidebarHome}`}>
    <PlanningSidebarSurface>
      <div className="shrink-0 px-1">{header}</div>
      {children}
    </PlanningSidebarSurface>
  </div>
}
