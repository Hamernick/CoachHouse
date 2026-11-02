"use client"

import { useId, useRef, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import styles from "./planning-sidebar.module.css"

export function PlanningSidebarSurface({ children }: { children: ReactNode }) {
  return <aside aria-label="Workspace planning" data-planning-sidebar className={styles.compactSidebar}>
    {children}
  </aside>
}

export function PlanningFeedSection({ label, count, open, onOpenChange, action, children }: {
  label: string
  count: number
  open: boolean
  onOpenChange: (open: boolean) => void
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  return <section className={styles.feedSection} data-open={open}
    onKeyDown={event => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault()
        onOpenChange(false)
        trigger.current?.focus({ preventScroll: true })
      }
    }}>
    <div className={styles.feedHeading}>
      <Button ref={trigger} variant="ghost" className={styles.feedTrigger} aria-label={label}
        aria-expanded={open} aria-controls={id} onClick={() => onOpenChange(!open)}>
        <span>{label}</span>
        {!open && count > 0 && <span className="text-muted-foreground tabular-nums">· {count}</span>}
        <ChevronRight aria-hidden className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
      </Button>
      {action}
    </div>
    <div id={id} className={styles.feedDisclosure} inert={!open} aria-hidden={!open}>
      <div className={styles.feedContent}>{children}</div>
    </div>
  </section>
}
