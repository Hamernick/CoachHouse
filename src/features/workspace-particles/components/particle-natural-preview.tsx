"use client"

import { useLayoutEffect, useRef, useState, type ReactNode } from "react"

/** Fit the complete source surface without changing its layout or aspect ratio. */
export function ParticleNaturalPreview({
  width,
  children,
}: {
  width: number
  children: ReactNode
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  useLayoutEffect(() => {
    const frame = frameRef.current
    const content = contentRef.current
    if (!frame || !content) return
    const measure = () => {
      const next = Math.min(
        1,
        frame.clientWidth / width,
        frame.clientHeight / Math.max(1, content.offsetHeight)
      )
      setScale((current) => (Math.abs(current - next) < 0.001 ? current : next))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    observer.observe(content)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={frameRef} className="relative size-full min-h-0 overflow-hidden">
      <div
        ref={contentRef}
        data-particle-natural-preview="true"
        className="pointer-events-none absolute top-0 left-1/2 origin-top"
        style={{ width, transform: `translateX(-50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  )
}
