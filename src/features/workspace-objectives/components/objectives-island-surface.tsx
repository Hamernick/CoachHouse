"use client"

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { CircularProgress } from "@/components/ui/circular-progress"

// Adapted from lab.xevrion.dev/r/dynamic-island: a top-anchored shell with
// final-size content. Text never scales or reflows while the shell morphs.
export function ObjectivesIslandSurface({ open, onOpenChange, completed = 0, total = 0, children, footer }: {
  open: boolean; onOpenChange: (open: boolean) => void; completed?: number; total?: number; children: ReactNode; footer?: ReactNode
}) {
  const progress = total > 0 ? (completed / total) * 100 : 0
  const host = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [size, setSize] = useState({ width: 420, height: 42 })
  const reduced = useReducedMotion()
  const id = useId()
  useLayoutEffect(() => {
    const measure = () => {
      if (!host.current || !content.current) return
      const width = Math.round(host.current.getBoundingClientRect().width)
      const height = Math.ceil(content.current.getBoundingClientRect().height) + 2
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height })
    }
    const observer = new ResizeObserver(measure)
    if (host.current) observer.observe(host.current)
    if (content.current) observer.observe(content.current)
    measure()
    return () => observer.disconnect()
  }, [])
  return <div ref={host} className="pointer-events-none flex w-[420px] max-w-full justify-center">
    <motion.div initial={false} animate={{ width: open ? size.width : 122, height: open ? size.height : 42, borderRadius: open ? 24 : 21 }}
      transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
      className="nodrag nopan nowheel pointer-events-auto relative overflow-hidden border border-border/60 bg-card shadow-none"
      onKeyDown={event => {
        if (event.key === "Escape" && !event.defaultPrevented) { event.preventDefault(); onOpenChange(false); trigger.current?.focus() }
      }}>
      <Button ref={trigger} variant="ghost" className="relative h-[42px] w-full justify-start gap-2 rounded-full px-3 text-left" aria-label="Objectives" aria-description={total > 0 ? `${completed} of ${total} objectives completed` : "No objectives yet"} aria-expanded={open} aria-controls={id}
        onClick={() => onOpenChange(!open)}>
        <CircularProgress value={progress} size={16} strokeWidth={2} decorative className="shrink-0"
          trackClassName="stroke-muted-foreground/60 dark:stroke-muted-foreground/60"
          progressClassName={progress === 100 ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-orange-600 dark:stroke-orange-400"} />
        <span>Objectives</span>
      </Button>
      <div ref={content} className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 pt-[42px]" style={{ width: size.width - 2 }}>
        <motion.div id={id} initial={false} animate={{ opacity: open ? 1 : 0, y: open ? 0 : -4 }}
          transition={{ duration: reduced ? 0 : 0.12, delay: open && !reduced ? 0.06 : 0 }} inert={!open} aria-hidden={!open}
          className={open ? "pointer-events-auto" : "pointer-events-none"}>
          <div className="flex max-h-[min(65svh,600px)] min-w-0 flex-col overflow-hidden px-3 pb-3">
            <div className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto overscroll-contain">{children}</div>
            {footer && <div className="shrink-0 pt-2">{footer}</div>}
          </div>
        </motion.div>
      </div>
    </motion.div>
  </div>
}
