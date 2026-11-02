"use client"

import { useLayoutEffect, useRef } from "react"
import { animate, motion, useMotionTemplate, useMotionValue, useReducedMotion } from "motion/react"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import styles from "./planning-sidebar.module.css"

// xevrion segmented-control: independently sprung pill edges and clipped labels.
// Keep Radix tab semantics and the existing workspace panels.
export function PlanningFeedTabs({ tab, objectives, opportunities, completed, onActivate }: {
  tab: string
  onActivate?: (tab: string) => void
  objectives: number
  opportunities: number
  completed: number
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const mode = useRef<"place" | "click" | "key">("place")
  const reduced = useReducedMotion()
  const left = useMotionValue(0)
  const right = useMotionValue(0)
  const clipPath = useMotionTemplate`inset(0px ${right}px 0px ${left}px round 999px)`
  const options = [
    { value: "objectives", label: "Objectives", count: objectives },
    { value: "opportunities", label: "Opportunities", count: opportunities },
  ]
  useLayoutEffect(() => {
    const list = listRef.current
    const overlay = overlayRef.current
    const selected = list?.querySelector<HTMLElement>('[data-state="active"]')
    if (!list || !overlay || !selected) return
    const measure = (resize: boolean) => {
      const nextLeft = selected.offsetLeft
      const nextRight = list.clientWidth - nextLeft - selected.offsetWidth
      if (resize || reduced || mode.current === "place") {
        left.jump(nextLeft); right.jump(nextRight)
      } else {
        const leading = { type: "spring", visualDuration: 0.18, bounce: 0 } as const
        const trailing = { type: "spring", visualDuration: 0.36, bounce: 0.15 } as const
        const keys = { type: "spring", visualDuration: 0.15, bounce: 0 } as const
        const movingRight = nextLeft > left.get()
        animate(left, nextLeft, mode.current === "key" ? keys : movingRight ? trailing : leading)
        animate(right, nextRight, mode.current === "key" ? keys : movingRight ? leading : trailing)
      }
      overlay.style.visibility = "visible"
    }
    measure(false)
    let first = true
    const observer = new ResizeObserver(() => { if (first) first = false; else measure(true) })
    observer.observe(list)
    return () => { observer.disconnect(); left.stop(); right.stop() }
  }, [tab, objectives, opportunities, reduced, left, right])
  return (
    <TabsList ref={listRef} aria-label="Workspace feeds" className={styles.navigation}
      onPointerDown={() => { mode.current = "click" }}
      onKeyDown={() => { mode.current = "key" }}>
      {options.map(option => <TabsTrigger key={option.value} value={option.value}
        onMouseDown={event => { if (onActivate && event.button === 0 && !event.ctrlKey) event.preventDefault() }}
        onClick={event => { if (onActivate) { event.currentTarget.focus(); onActivate(option.value) } }}
        onKeyDown={event => { if (onActivate && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onActivate(option.value) } }}
        aria-label={option.label} className={styles.navigationItem}
        aria-description={option.value === "objectives" ? `${completed} of ${objectives} objectives completed` : `${opportunities} opportunities`}>
        <span>{option.label} <span className="tabular-nums">({option.count})</span></span>
      </TabsTrigger>)}
      <motion.div ref={overlayRef} aria-hidden style={{ clipPath }} className={styles.segmentHighlight}>
        {options.map(option => <span key={option.value} className={styles.segmentLabel}>
          <span>{option.label} <span className="tabular-nums">({option.count})</span></span>
        </span>)}
      </motion.div>
    </TabsList>
  )
}
