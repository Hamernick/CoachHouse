"use client"

import { useCallback, useRef } from "react"

export type ScrollFadeOrientation = "horizontal" | "vertical"

function updateScrollFadeState(
  element: HTMLElement,
  orientation: ScrollFadeOrientation
) {
  const vertical = orientation === "vertical"
  const extent = Math.max(
    0,
    vertical
      ? element.scrollHeight - element.clientHeight
      : element.scrollWidth - element.clientWidth
  )
  // Horizontal distances are physical left/right, including negative RTL scrollLeft.
  const rtl = !vertical && getComputedStyle(element).direction === "rtl"
  const offset = vertical
    ? element.scrollTop
    : rtl
      ? extent + element.scrollLeft
      : element.scrollLeft
  const position = Math.min(extent, Math.max(0, offset))
  const start = extent > 1 && position > 1 ? position : 0
  const end = extent > 1 && extent - position > 1 ? extent - position : 0
  const nextStart = start > 0 ? "visible" : "hidden"
  const nextEnd = end > 0 ? "visible" : "hidden"

  element.dataset.scrollFadeManaged = "true"
  if (element.dataset.scrollFadeStart !== nextStart)
    element.dataset.scrollFadeStart = nextStart
  if (element.dataset.scrollFadeEnd !== nextEnd)
    element.dataset.scrollFadeEnd = nextEnd
  element.style.setProperty("--scroll-fade-start-distance", `${start}px`)
  element.style.setProperty("--scroll-fade-end-distance", `${end}px`)
}

export function useScrollFadeEffect(
  enabled: boolean,
  orientation: ScrollFadeOrientation = "vertical"
) {
  const cleanupRef = useRef<(() => void) | null>(null)

  return useCallback(
    (element: HTMLDivElement | null) => {
      cleanupRef.current?.()
      cleanupRef.current = null
      if (!element || !enabled) return

      let frame: number | null = null
      const update = () => {
        frame = null
        updateScrollFadeState(element, orientation)
      }
      const schedule = () => {
        if (frame === null) frame = window.requestAnimationFrame(update)
      }
      const resizeObserver =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(schedule)
      const observeContent = () => {
        resizeObserver?.disconnect()
        resizeObserver?.observe(element)
        for (const child of element.children) resizeObserver?.observe(child)
      }
      const mutationObserver =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(() => {
              observeContent()
              schedule()
            })

      update()
      schedule()
      element.addEventListener("scroll", schedule, { passive: true })
      element.addEventListener("load", schedule, true)
      window.addEventListener("resize", schedule)
      document.fonts?.addEventListener("loadingdone", schedule)
      observeContent()
      mutationObserver?.observe(element, {
        childList: true,
        characterData: true,
        subtree: true,
      })
      // Watch local sizing/direction changes without observing our own style writes.
      const attributeObserver =
        typeof MutationObserver === "undefined"
          ? null
          : new MutationObserver(schedule)
      attributeObserver?.observe(element, {
        attributes: true,
        attributeFilter: ["class", "dir", "hidden"],
      })

      cleanupRef.current = () => {
        element.removeEventListener("scroll", schedule)
        element.removeEventListener("load", schedule, true)
        window.removeEventListener("resize", schedule)
        document.fonts?.removeEventListener("loadingdone", schedule)
        if (frame !== null) window.cancelAnimationFrame(frame)
        resizeObserver?.disconnect()
        mutationObserver?.disconnect()
        attributeObserver?.disconnect()
        delete element.dataset.scrollFadeManaged
        delete element.dataset.scrollFadeStart
        delete element.dataset.scrollFadeEnd
        element.style.removeProperty("--scroll-fade-start-distance")
        element.style.removeProperty("--scroll-fade-end-distance")
      }
    },
    [enabled, orientation]
  )
}
