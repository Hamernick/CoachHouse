"use client"

import { useLayoutEffect, useState } from "react"

// Vaul measures custom-container snap offsets on render, but only subscribes to
// window resize. Canvas layout can change independently during shell startup.
export function useWorkspaceDrawerCanvasSize(container: HTMLElement | null) {
  const [measurement, setMeasurement] = useState<{
    container: HTMLElement
    height: number
    width: number
  } | null>(null)

  useLayoutEffect(() => {
    if (!container) return
    const measure = () => {
      // Match the portal's inner layout box, excluding borders and scrollbars.
      const height = container.clientHeight
      const width = container.clientWidth
      setMeasurement((current) =>
        current?.container === container &&
        current.height === height &&
        current.width === width
          ? current
          : { container, height, width }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [container])

  return measurement?.container === container && measurement
    ? measurement
    : { width: 0, height: 0 }
}
