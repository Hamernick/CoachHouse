"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export function resolveHoverRevealScrollDistance({
  contentWidth,
  viewportWidth,
  trailingPadding = 8,
}: {
  contentWidth: number
  viewportWidth: number
  trailingPadding?: number
}) {
  const overflowWidth = Math.max(0, Math.ceil(contentWidth - viewportWidth))
  if (overflowWidth === 0) {
    return 0
  }

  return overflowWidth + trailingPadding
}

export function HoverRevealText({ label, slot }: { label: string; slot?: string }) {
  const viewportRef = useRef<HTMLSpanElement | null>(null)
  const contentRef = useRef<HTMLSpanElement | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [scrollDistance, setScrollDistance] = useState(0)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    if (!viewport || !content) return

    const measure = () => {
      const nextScrollDistance =
        resolveHoverRevealScrollDistance({
          contentWidth: content.scrollWidth,
          viewportWidth: viewport.clientWidth,
        })
      setScrollDistance(nextScrollDistance)
    }

    measure()

    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(content)

    return () => observer.disconnect()
  }, [label])

  return (
    <span
      ref={viewportRef}
      className="relative block min-w-0 flex-1 overflow-hidden"
      data-slot={slot}
      onPointerEnter={(event) => setIsHovered(event.pointerType === "mouse")}
      onPointerLeave={() => setIsHovered(false)}
    >
      <span
        ref={contentRef}
        className={cn(
          "block min-w-full text-left whitespace-nowrap",
          scrollDistance > 0 && isHovered
            ? "w-max transition-transform duration-1000 ease-out motion-reduce:transition-none"
            : "w-full truncate"
        )}
        style={
          scrollDistance > 0 && isHovered
            ? { transform: `translateX(-${scrollDistance}px)` }
            : undefined
        }
      >
        {label}
      </span>
    </span>
  )
}

