"use client"

import { useEffect, useState, type RefObject } from "react"

type ScrollPosition = Pick<HTMLElement, "scrollTop" | "scrollHeight" | "clientHeight">

export function resolveMapCompactState(
  collapsed: boolean,
  page: ScrollPosition,
  feed?: ScrollPosition | null
) {
  const offset = Math.max(page.scrollTop, feed?.scrollTop ?? 0)
  const activeScroll = page.scrollTop > (feed?.scrollTop ?? 0) ? page : feed ?? page
  // Keep a short feed compact if expanding its viewport consumed its scroll
  // range. An upward gesture at the top explicitly restores the map.
  return collapsed
    ? offset > 4 || activeScroll.scrollHeight <= activeScroll.clientHeight + 1
    : offset > 16
}

// Collapse the viewport, not the Mapbox canvas: keep camera, tiles and pins alive.
export function useCollapsingMap(
  screenRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  contentActive: boolean
) {
  const [pinned, setPinned] = useState(false)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const screen = screenRef.current
    const content = contentRef.current
    const scroll = content?.closest<HTMLElement>("[data-public-resource-unframed]")
    if (!screen || !content || !scroll) return
    setPinned(true)
    if (contentActive) {
      setCompact(false)
      return
    }

    let collapsed = false
    const panel = content.querySelector<HTMLElement>("[data-public-map-explorer-panel]")
    const card = content.querySelector<HTMLElement>("[data-public-map-card]")
    const clipFeed = () => {
      if (!panel || !card) return
      const inset = Math.max(0, card.getBoundingClientRect().bottom - panel.getBoundingClientRect().top)
      // Clip the feed itself: no overlay intercepting map/header controls.
      panel.style.clipPath = `inset(${inset}px 0 0)`
      const feed = content.querySelector<HTMLElement>("[data-public-map-result-feed]")
      if (feed) feed.dataset.scrolled = String(feed.scrollTop > 4)
      panel.dataset.scrolled = String(scroll.scrollTop > 4)
      panel.style.setProperty("--map-scroll-fade-inset", `${inset}px`)
    }
    const measure = () => {
      screen.style.setProperty("--map-expanded-height", `${screen.clientWidth * 9 / 16}px`)
      clipFeed()
    }
    const onScroll = () => {
      clipFeed()
      const feed = content.querySelector<HTMLElement>("[data-public-map-result-feed]")
      // Separate thresholds prevent flicker around the transition point.
      const next = resolveMapCompactState(collapsed, scroll, feed)
      if (next === collapsed) return
      collapsed = next
      setCompact(next)
    }
    measure()
    onScroll()
    const observer = new ResizeObserver(measure)
    observer.observe(screen)
    if (card) observer.observe(card)
    if (panel) observer.observe(panel)
    scroll.addEventListener("scroll", onScroll, { passive: true, capture: true })
    const restoreAtTop = () => {
      const feed = content.querySelector<HTMLElement>("[data-public-map-result-feed]")
      if (!collapsed || Math.max(scroll.scrollTop, feed?.scrollTop ?? 0) > 4) return
      collapsed = false
      setCompact(false)
    }
    const onWheel = (event: WheelEvent) => { if (event.deltaY < 0) restoreAtTop() }
    let touchY = 0
    const onTouchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0 }
    const onTouchMove = (event: TouchEvent) => {
      const nextY = event.touches[0]?.clientY ?? touchY
      if (nextY > touchY) restoreAtTop()
      touchY = nextY
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (["Home", "PageUp", "ArrowUp"].includes(event.key)) restoreAtTop()
    }
    scroll.addEventListener("wheel", onWheel, { passive: true })
    scroll.addEventListener("touchstart", onTouchStart, { passive: true })
    scroll.addEventListener("touchmove", onTouchMove, { passive: true })
    scroll.addEventListener("keydown", onKeyDown)
    return () => {
      observer.disconnect()
      scroll.removeEventListener("scroll", onScroll, true)
      scroll.removeEventListener("wheel", onWheel)
      scroll.removeEventListener("touchstart", onTouchStart)
      scroll.removeEventListener("touchmove", onTouchMove)
      scroll.removeEventListener("keydown", onKeyDown)
      if (panel) {
        panel.style.removeProperty("clip-path")
        panel.style.removeProperty("--map-scroll-fade-inset")
        delete panel.dataset.scrolled
      }
    }
  }, [screenRef, contentRef, contentActive])

  return { pinned, compact }
}
