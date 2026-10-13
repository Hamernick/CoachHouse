"use client"

import { useEffect, useRef, useState } from "react"
import Lenis from "lenis"

const DOCK_CORNER_CLEARANCE = 28

// Size the contained feed to the dock without growing the page underneath it.
export function useOrganizationFeedViewport(enabled: boolean, resetKey: string, empty: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number>()

  useEffect(() => {
    const list = ref.current
    if (!enabled || !list) return
    const scroll = list.closest<HTMLElement>("[data-public-home-scroll]")
    const dock = document.querySelector<HTMLElement>("[data-public-map-search-dock]")
    const feed = list.querySelector<HTMLElement>("[data-public-map-result-feed]")
    scroll?.scrollTo({ top: 0, behavior: "instant" })
    feed?.scrollTo({ top: 0, behavior: "instant" })
    const feedContent = feed?.querySelector<HTMLElement>("[data-public-map-feed-content]")
    const smoothScroll = feed && feedContent ? new Lenis({
      wrapper: feed,
      content: feedContent,
      autoRaf: true,
      lerp: 0.1,
      smoothWheel: true,
      syncTouch: true,
      syncTouchLerp: 0.075,
      respectReducedMotion: true,
    }) : null
    const measure = () => {
      const top = list.getBoundingClientRect().top + (scroll?.scrollTop ?? 0)
      const dockBounds = dock?.getBoundingClientRect()
      // End deep inside the dock, before its rounded bottom corners. The dock
      // covers the cutoff; end padding keeps the final action reachable above it.
      const overlap = dockBounds ? Math.max(0, dockBounds.height - DOCK_CORNER_CLEARANCE) : 0
      const bottom = dockBounds ? dockBounds.top + overlap : window.innerHeight - 128
      list.style.setProperty("--map-feed-dock-overlap", `${overlap}px`)
      setHeight(Math.max(80, bottom - top))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    const region = list.closest("[data-public-map-results-region]")
    if (region) observer.observe(region)
    if (dock) observer.observe(dock)
    const map = document.querySelector("[data-public-map-screen]")
    if (map) observer.observe(map)
    window.addEventListener("resize", measure)
    window.visualViewport?.addEventListener("resize", measure)
    return () => {
      smoothScroll?.destroy()
      observer.disconnect()
      window.removeEventListener("resize", measure)
      window.visualViewport?.removeEventListener("resize", measure)
    }
  }, [enabled, resetKey, empty])

  return { ref, height }
}
