"use client"

import { useLayoutEffect, useState, type RefObject } from "react"

// Measure once per resize, never per animation frame. Keep the trigger in the
// layout while hidden so close/reopen and responsive changes share its bounds.
export function useWorkspaceOrganizationTriggerSize(
  triggerRef?: RefObject<HTMLButtonElement | null>
) {
  const [size, setSize] = useState({ width: 208, height: 42 })
  useLayoutEffect(() => {
    const trigger = triggerRef?.current
    if (!trigger) return
    const measure = () => {
      const { width, height } = trigger.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      setSize((previous) => previous.width === width && previous.height === height
        ? previous : { width, height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(trigger)
    return () => observer.disconnect()
  }, [triggerRef])
  return size
}
