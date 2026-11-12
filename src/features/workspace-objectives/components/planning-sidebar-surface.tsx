"use client"

import { createContext, useContext, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import styles from "./planning-sidebar.module.css"

const PlanningColumns = createContext<{ compact: boolean; selected: string } | null>(null)

export function PlanningSidebarSurface({ children, columns = false }: { children: ReactNode; columns?: boolean }) {
  const root = useRef<HTMLElement>(null)
  const [compact, setCompact] = useState(false)
  const [selected, setSelected] = useState("Objectives")
  useLayoutEffect(() => {
    if (!columns || !root.current) return
    const node = root.current
    const measure = () => setCompact(node.clientWidth < 560)
    const observer = new ResizeObserver(measure)
    observer.observe(node); measure()
    return () => observer.disconnect()
  }, [columns])
  return <aside ref={root} aria-label="Workspace planning" data-planning-sidebar className={cn(styles.compactSidebar, columns && styles.columns)}>
    {columns ? <PlanningColumns.Provider value={{ compact, selected }}><Tabs value={selected} onValueChange={setSelected} className={styles.columnsTabs}>
      <TabsList aria-label="Planning" className={styles.planningTabs} hidden={!compact}>
        {["Objectives", "Opportunities"].map(label => <TabsTrigger key={label} value={label} className={styles.planningTab}>{label}</TabsTrigger>)}
      </TabsList>
      <div className={styles.columnsPanels} data-compact={compact}>{children}</div>
    </Tabs></PlanningColumns.Provider> : children}
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
  const columns = useContext(PlanningColumns)
  const expanded = open || Boolean(columns?.compact && columns.selected === label)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const section = <section className={styles.feedSection} data-open={expanded} data-planning-tab-hidden={Boolean(columns?.compact && columns.selected !== label)}
    aria-hidden={columns?.compact && columns.selected !== label || undefined} inert={columns?.compact && columns.selected !== label || undefined}
    onKeyDown={event => {
      if (!columns?.compact && event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault()
        onOpenChange(false)
        trigger.current?.focus({ preventScroll: true })
      }
    }}>
    <div className={styles.feedHeading}>
      {!columns?.compact && <Button ref={trigger} variant="ghost" className={styles.feedTrigger} aria-label={label}
        aria-expanded={expanded} aria-controls={id} onClick={() => onOpenChange(!open)}>
        <span>{label}</span>
        {!open && count > 0 && <span className="text-muted-foreground tabular-nums">· {count}</span>}
        <ChevronRight aria-hidden className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-90" : ""}`} />
      </Button>}
      {action}
    </div>
    <div id={id} className={styles.feedDisclosure} inert={!expanded} aria-hidden={!expanded}>
      <div className={styles.feedContent}>{children}</div>
    </div>
  </section>
  return columns ? <TabsContent value={label} forceMount asChild>{section}</TabsContent> : section
}
