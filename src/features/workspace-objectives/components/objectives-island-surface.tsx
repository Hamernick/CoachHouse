"use client"

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import styles from "./planning-sidebar.module.css"
import { CircularProgress } from "@/components/ui/circular-progress"

// Adapted from lab.xevrion.dev/r/dynamic-island: a top-anchored shell with
// final-size content. Text never scales or reflows while the shell morphs.
export function ObjectivesIslandSurface({ open, onOpenChange, completed = 0, total = 0, children, footer, header, toolbar, closedWidth = 124, label = "Objectives", count, showProgress = true, centered = false }: {
  label?: string; count?: number; showProgress?: boolean; centered?: boolean
  open: boolean; onOpenChange: (open: boolean) => void; completed?: number; total?: number; children: ReactNode; footer?: ReactNode; header?: ReactNode; toolbar?: ReactNode; closedWidth?: number
}) {
  const progress = total > 0 ? (completed / total) * 100 : 0
  const host = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [size, setSize] = useState({ width: 420, height: 42, availableHeight: 600 })
  const reduced = useReducedMotion()
  const id = useId()
  useLayoutEffect(() => {
    const measure = () => {
      if (!host.current || !content.current) return
      const width = Math.round(host.current.getBoundingClientRect().width)
      const height = Math.ceil(content.current.getBoundingClientRect().height) + 2
      const availableHeight = centered ? host.current.clientHeight : 600
      setSize(previous => previous.width === width && previous.height === height && previous.availableHeight === availableHeight ? previous : { width, height, availableHeight })
    }
    const observer = new ResizeObserver(measure)
    if (host.current) observer.observe(host.current)
    if (content.current) observer.observe(content.current)
    measure()
    return () => observer.disconnect()
  }, [centered])
  return <div ref={host} className={`pointer-events-none flex w-[420px] max-w-full ${centered ? "h-full justify-center" : "justify-start"}`}>
    <motion.div data-workspace-canvas-occluder data-open={open} initial={false} animate={{ width: open ? size.width : closedWidth, height: open ? size.height : centered ? 34 : header ? 44 : 42, borderRadius: open ? 24 : centered ? 17 : header ? 22 : 21 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`nodrag nopan nowheel pointer-events-auto relative overflow-hidden border border-border/60 shadow-none ${centered ? `canvas-glass ${styles.island}` : "bg-card"}`}
      onKeyDown={event => {
        if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onOpenChange(false); (trigger.current ?? host.current?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]'))?.focus() }
      }}>
      {header ?? <Button ref={trigger} variant="ghost" className={`relative flex ${centered && !open ? "h-8" : "h-[42px]"} w-full gap-2 rounded-full ${centered && open ? "px-12" : "px-3"} py-0 ${centered ? "justify-center" : "justify-start text-left"}`} aria-label={label} aria-description={showProgress ? (total > 0 ? `${completed} of ${total} objectives completed` : "No objectives yet") : undefined} aria-expanded={open} aria-controls={id}
        onClick={event => { event.currentTarget.focus({ preventScroll: true }); onOpenChange(!open) }}>
        {showProgress && <CircularProgress value={progress} size={16} strokeWidth={2} decorative className="shrink-0"
          trackClassName="stroke-muted-foreground/60 dark:stroke-muted-foreground/60"
          progressClassName={progress === 100 ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-orange-600 dark:stroke-orange-400"} />}
        <span>{label}{count !== undefined && <> <span className="tabular-nums">({count})</span></>}</span>
      </Button>}
      {centered && open && <Button type="button" variant="ghost" size="icon" className="absolute top-0.5 right-1 z-10 size-9 rounded-full" aria-label={`Close ${label.toLowerCase()}`} aria-controls={id}
        onClick={() => { onOpenChange(false); requestAnimationFrame(() => trigger.current?.focus()) }}>
        <X aria-hidden />
      </Button>}
      <div ref={content} className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 pt-[42px]" style={{ width: size.width - 2 }}>
        <motion.div id={id} initial={false} animate={{ opacity: open ? 1 : 0, y: open ? 0 : -4 }}
          transition={{ duration: reduced ? 0 : 0.12, delay: open && !reduced ? 0.06 : 0 }} inert={!open} aria-hidden={!open}
          className={open ? "pointer-events-auto" : "pointer-events-none"}>
          <div className={`flex max-h-[min(65svh,600px)] min-w-0 flex-col overflow-hidden px-3 pt-3 ${footer ? "pb-0" : "pb-3"}`} style={centered ? { maxHeight: `min(65svh, 600px, ${Math.max(0, size.availableHeight - 44)}px)` } : undefined}>
            {toolbar && <div className="shrink-0">{toolbar}</div>}
            <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-hidden">{children}</div>
            {footer && <div className="shrink-0">{footer}</div>}
          </div>
        </motion.div>
      </div>
    </motion.div>
  </div>
}
