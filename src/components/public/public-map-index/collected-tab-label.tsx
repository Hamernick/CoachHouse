"use client"

import { useEffect, useRef } from "react"

const compactCount = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
})

export function formatCollectedCount(count: number) {
  return compactCount.format(count).toLowerCase()
}

export function PublicMapCollectedTabLabel({ count }: { count: number }) {
  const labelRef = useRef<HTMLSpanElement>(null)
  const previousCount = useRef(count)

  useEffect(() => {
    if (previousCount.current === count) return
    previousCount.current = count
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const animation = labelRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(4px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    )
    return () => animation?.cancel()
  }, [count])

  return (
    <span className="relative inline-flex items-center whitespace-nowrap">
      <span
        ref={labelRef}
        aria-hidden
        className="inline-block tabular-nums"
      >
        {count > 0 ? `Collected (${formatCollectedCount(count)})` : "Collect"}
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {count > 0
          ? `Collected ${count.toLocaleString("en-US")} ${count === 1 ? "item" : "items"}`
          : "Collect"}
      </span>
    </span>
  )
}
