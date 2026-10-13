"use client"

import { useEffect, type RefObject } from "react"
import Lenis from "lenis"
import "lenis/dist/lenis.css"

// Uses Lenis's documented custom-wrapper setup and native gesture exclusions.
// https://github.com/darkroomengineering/lenis#settings
export function usePublicMapPageScroll(contentRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const content = contentRef.current
    const wrapper = content?.closest<HTMLElement>("[data-public-home-scroll], main")
    if (!content || !wrapper) return

    const lenis = new Lenis({
      wrapper,
      content,
      autoRaf: true,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: true,
      syncTouchLerp: 0.075,
      anchors: true,
      stopInertiaOnNavigate: true,
      respectReducedMotion: true,
      prevent: (node) => node.hasAttribute("data-public-map-drawer-mode") ||
        node.getAttribute("role") === "dialog",
    })

    return () => lenis.destroy()
  }, [contentRef])
}
