"use client"

import { useLayoutEffect, useState, type RefObject } from "react"

// Measure once per resize, never per animation frame. Keep the trigger in the
// layout while hidden so close/reopen and responsive changes share its bounds.
export function useWorkspaceOrganizationTriggerSize(
  triggerRef?: RefObject<HTMLButtonElement | null>
) {
  const [size, setSize] = useState({ width: 208, height: 42, unified: false })
  useLayoutEffect(() => {
    const button = triggerRef?.current
    if (!button) return
    const trigger = button.closest<HTMLElement>("[data-workspace-sidebar-home]")?.querySelector<HTMLElement>("[data-planning-sidebar]") ?? button
    const unified = trigger !== button
    const measure = () => {
      const { width, height } = trigger.getBoundingClientRect()
      if (width <= 0 || height <= 0) return
      setSize((previous) => previous.width === width && previous.height === height && previous.unified === unified
        ? previous : { width, height, unified })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(trigger)
    return () => observer.disconnect()
  }, [triggerRef])
  return size
}
