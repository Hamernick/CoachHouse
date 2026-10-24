"use client"

import { useLayoutEffect, useMemo, useState } from "react"

import {
  WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
  WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
} from "./workspace-canvas-overlay-drawer-state"

// The collapsed detent includes the actual composer: wrapped input, errors and
// the bottom safe area must never push the send control below the sheet.
export function useWorkspaceComposerHeight() {
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const [height, setHeight] = useState(58)
  const [chrome, setChrome] = useState({ header: 8, total: 10 })
  useLayoutEffect(() => {
    if (!element) return
    const measure = () => {
      setHeight(Math.ceil(element.getBoundingClientRect().height))
      const style = getComputedStyle(element)
      const header =
        parseFloat(style.getPropertyValue("--workspace-dock-padding-top")) ||
        8
      setChrome((current) =>
        current.header === header && current.total === header + 2
          ? current
          : { header, total: header + 2 }
      )
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    const pointer = window.matchMedia("(pointer: coarse)")
    pointer.addEventListener("change", measure)
    return () => {
      observer.disconnect()
      pointer.removeEventListener("change", measure)
    }
  }, [element])
  // Measure the input-mode-specific chrome; preserve the floating clearance.
  const composerPeek = `${chrome.total + 32 + height}px`
  const composerSnaps = useMemo(
    () => [
      composerPeek,
      WORKSPACE_DATA_DRAWER_DEFAULT_SNAP_POINT,
      WORKSPACE_DATA_DRAWER_FULL_SNAP_POINT,
    ],
    [composerPeek]
  )
  return {
    chrome,
    composerRef: setElement,
    composerHeight: height,
    composerPeek,
    composerSnaps,
  }
}
