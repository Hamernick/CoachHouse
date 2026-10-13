"use client"

import { useEffect, useId, useRef, type RefObject } from "react"
import { setupGuideConnectorPath } from "../lib/setup-guide-connector"
import type { GuideRect } from "../lib/setup-guide-placement"
import styles from "./workspace-setup-guide.module.css"

export function SetupGuideConnector({ cardRef, target, position }: {
  cardRef: RefObject<HTMLElement | null>
  target: GuideRect | null
  position: { left: number; top: number; width: number; maxHeight: number } | null
}) {
  const path = useRef<SVGPathElement>(null)
  const id = useId().replace(/:/g, "")
  useEffect(() => {
    if (!target || !position) return
    let frame = 0
    const until = performance.now() + 450
    const draw = () => {
      const card = cardRef.current?.getBoundingClientRect()
      if (card) path.current?.setAttribute("d", setupGuideConnectorPath(card, target))
      if (performance.now() < until) frame = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(frame)
  }, [cardRef, target, position])
  if (!target || !position) return null
  return <svg aria-hidden="true" className="pointer-events-none fixed inset-0 h-full w-full overflow-visible">
    <defs><linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="var(--chart-2)" /><stop offset="1" stopColor="var(--chart-3)" /></linearGradient></defs>
    <path ref={path} className={styles.connector} fill="none" stroke={`url(#${id})`} strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
  </svg>
}
