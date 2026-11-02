"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import styles from "./particle-objectives.module.css"

const TRUNK = 8
const BEND = 5
const REACH = 14
const branch = (y: number) => `M${TRUNK} ${Math.max(0, y - BEND)} Q${TRUNK} ${y} ${TRUNK + BEND} ${y} H${REACH}`

// xevrion sidebar-submenu geometry, measured against real draggable rows.
export function PlanSubmenuRail({ selectedId, children }: {
  selectedId: string | null
  children: ReactNode
}) {
  const root = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [geometry, setGeometry] = useState<{ rows: { id: string; y: number }[]; height: number }>({ rows: [], height: 0 })
  const y = useMotionValue(0)
  const lit = useTransform(y, value => `M${TRUNK} 0 V${Math.max(0, value - BEND)} Q${TRUNK} ${value} ${TRUNK + BEND} ${value} H${REACH}`)
  useLayoutEffect(() => {
    const element = root.current
    if (!element) return
    const measure = () => {
      const top = element.getBoundingClientRect().top
      const rows = [...element.querySelectorAll<HTMLElement>("[data-plan-member], [data-plan-add]")].map(row => {
        const bounds = row.getBoundingClientRect()
        return { id: row.dataset.planMember ?? "add-to-plan", y: bounds.top - top + bounds.height / 2 }
      })
      const next = { rows, height: element.clientHeight }
      setGeometry(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const resize = new ResizeObserver(measure)
    const observe = () => {
      resize.disconnect()
      resize.observe(element)
      element.querySelectorAll("[data-plan-member], [data-plan-add]").forEach(row => resize.observe(row))
      measure()
    }
    const mutation = new MutationObserver(observe)
    mutation.observe(element, { childList: true, subtree: true })
    observe()
    return () => { resize.disconnect(); mutation.disconnect() }
  }, [])
  const selected = geometry.rows.find(row => row.id === selectedId)
  useLayoutEffect(() => {
    if (!selected) return
    if (reduced) y.jump(selected.y)
    else {
      const animation = animate(y, selected.y, { type: "spring", visualDuration: 0.35, bounce: 0.12 })
      return () => animation.stop()
    }
  }, [selected, reduced, y])
  const last = geometry.rows.at(-1)
  const tree = last ? [`M${TRUNK} 0 V${Math.max(0, last.y - BEND)}`, ...geometry.rows.map(row => branch(row.y))].join(" ") : ""
  return <div ref={root} className={styles.submenu}>
    {last && <svg data-plan-submenu-rail aria-hidden className={styles.submenuRail} width={REACH} height={geometry.height} fill="none" strokeWidth={2} strokeLinecap="round">
      <path d={tree} className={styles.submenuTrack} />
      {selected && <motion.path data-plan-active-rail d={lit} className={styles.submenuActive} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.4, ease: [0.23, 1, 0.32, 1] }} />}
    </svg>}
    {children}
  </div>
}
