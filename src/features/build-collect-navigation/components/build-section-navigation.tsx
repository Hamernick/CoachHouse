"use client"

import { useEffect } from "react"

// Coordinate focus and scrolling once, rather than letting a tall focused
// section compete with Next's hash scrolling beneath the sticky header.
export function BuildSectionNavigation() {
  useEffect(() => {
    let frame = 0
    const goTo = (hash: string, animate: boolean) => {
      const target = document.getElementById(hash.slice(1))
      if (!target) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        target.focus({ preventScroll: true })
        target.scrollIntoView({
          block: "start",
          behavior: animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant",
        })
      })
    }
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target || anchor.hasAttribute("download")) return
      const url = new URL(anchor.href)
      if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash || !document.getElementById(url.hash.slice(1))) return
      event.preventDefault()
      if (location.hash !== url.hash) history.pushState(null, "", url)
      goTo(url.hash, true)
    }
    // Capturing prevents the Link's second scroll, without stopping menu close.
    document.addEventListener("click", onClick, true)
    if (location.hash) goTo(location.hash, false)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener("click", onClick, true)
    }
  }, [])
  return null
}
