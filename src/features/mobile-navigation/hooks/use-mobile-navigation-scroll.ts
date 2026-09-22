"use client"

import { useEffect, useState } from "react"

export function useMobileNavigationScroll() {
  const [compact, setCompact] = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)

  useEffect(() => {
    let lastTop = 0
    let lastTarget: EventTarget | null = null
    function onScroll(event: Event) {
      const target = event.target
      // Ignore menus, dialogs and independently scrolling nested lists.
      if (
        target !== document &&
        !(
          target instanceof HTMLElement && target.matches("[data-shell-scroll]")
        )
      )
        return
      const element =
        target === document
          ? document.scrollingElement
          : (target as HTMLElement)
      if (!element) return
      const top = Math.max(
        0,
        Math.min(element.scrollTop, element.scrollHeight - element.clientHeight)
      )
      if (target !== lastTarget) {
        lastTop = 0
        lastTarget = target
      }
      if (top < 24) setCompact(false)
      else if (Math.abs(top - lastTop) > 12) setCompact(top > lastTop)
      if (Math.abs(top - lastTop) > 12 || top < 24) lastTop = top
    }
    const viewport = window.visualViewport
    function onViewportChange() {
      const editing = document.activeElement?.matches(
        "input, textarea, [contenteditable='true']"
      )
      setKeyboardOpen(
        Boolean(
          editing && viewport && window.innerHeight - viewport.height > 150
        )
      )
    }
    document.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    })
    viewport?.addEventListener("resize", onViewportChange)
    document.addEventListener("focusin", onViewportChange)
    document.addEventListener("focusout", onViewportChange)
    return () => {
      document.removeEventListener("scroll", onScroll, true)
      viewport?.removeEventListener("resize", onViewportChange)
      document.removeEventListener("focusin", onViewportChange)
      document.removeEventListener("focusout", onViewportChange)
    }
  }, [])

  return { compact, keyboardOpen }
}
