"use client"

import { useEffect, useRef } from "react"
import type { Figure } from "@lucasmarkes/hairline"

export type MenuFigureName = "exploded" | "terrain" | "slow" | "basket" | "drawer"

export function MenuFigure({ name }: { name: MenuFigureName }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = ref.current
    const link = host?.closest("a")
    if (!host || !link) return
    let disposed = false
    let cleanup = () => {}

    void import("@lucasmarkes/hairline").then((hairline) => {
      if (disposed) return
      const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
      let figure: Figure | null = null
      const start = () => {
        host.replaceChildren()
        figure = hairline[name](host)
        // The library leaves different amounts of whitespace around each figure.
        // Center its resting artwork without changing the shared illustration scale.
        const svg = host.querySelector("svg")
        if (svg) {
          const bounds = svg.getBBox()
          if (bounds.width && bounds.height) {
            svg.setAttribute("viewBox", `${bounds.x + bounds.width / 2 - 200} ${bounds.y + bounds.height / 2 - 160} 400 320`)
          }
        }
      }
      // Version 0.3 has no pause API. Retain its own SVG and dispose the engine
      // so idle menu items have no animation loop or pointer listeners.
      const stop = () => {
        if (!figure) return
        const still = host.querySelector("svg")?.cloneNode(true)
        figure.destroy()
        figure = null
        if (still) host.replaceChildren(still)
      }
      const move = (event: PointerEvent) => {
        if (event.pointerType === "touch" || motion.matches) return
        if (!figure) start()
        const bounds = host.getBoundingClientRect()
        const row = link.getBoundingClientRect()
        // Hovering the label also animates its illustration.
        host.dispatchEvent(new PointerEvent("pointermove", {
          pointerType: event.pointerType,
          clientX: bounds.left + Math.max(0, Math.min(1, (event.clientX - row.left) / row.width)) * bounds.width,
          clientY: bounds.top + Math.max(0, Math.min(1, (event.clientY - row.top) / row.height)) * bounds.height,
        }))
      }
      const hide = () => { if (document.hidden) stop() }
      start()
      stop()
      link.addEventListener("pointerenter", move)
      link.addEventListener("pointermove", move)
      link.addEventListener("pointerleave", stop)
      link.addEventListener("pointercancel", stop)
      window.addEventListener("blur", stop)
      document.addEventListener("visibilitychange", hide)
      motion.addEventListener("change", stop)
      cleanup = () => {
        link.removeEventListener("pointerenter", move)
        link.removeEventListener("pointermove", move)
        link.removeEventListener("pointerleave", stop)
        link.removeEventListener("pointercancel", stop)
        window.removeEventListener("blur", stop)
        document.removeEventListener("visibilitychange", hide)
        motion.removeEventListener("change", stop)
        figure?.destroy()
        host.replaceChildren()
      }
    })
    return () => {
      disposed = true
      cleanup()
    }
  }, [name])

  return (
    <div aria-hidden="true" className="aspect-[5/4] w-20 shrink-0 [--hairline-hi:var(--foreground)] [--hairline-edge:var(--muted-foreground)] [--hairline-mid:var(--muted-foreground)] [--hairline-lo:var(--border)]">
      <div ref={ref} data-hairline={name} className="pointer-events-none size-full [&>svg]:block [&>svg]:!size-full" />
    </div>
  )
}
