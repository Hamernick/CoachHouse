"use client"

import { useEffect, useRef, useState } from "react"

export type DocumentationContents = ReadonlyArray<readonly [string, string]>

export function useDocumentationContents(items: DocumentationContents) {
  const navigationRef = useRef<HTMLElement>(null)
  const [activeId, setActiveId] = useState(items[0]?.[0] ?? "")
  const [indicator, setIndicator] = useState({
    top: 0,
    height: 0,
    visible: false,
  })

  useEffect(() => {
    const root = navigationRef.current?.closest<HTMLElement>(
      "[data-documentation-scroll]"
    )
    if (!root) return
    let frame = 0
    function update() {
      frame = 0
      const sections = items.flatMap(([id]) => {
        const element = document.getElementById(id)
        return element?.getClientRects().length ? [{ id, element }] : []
      })
      if (!sections.length) return
      const margin =
        parseFloat(getComputedStyle(sections[0].element).scrollMarginTop) || 24
      const threshold = root!.getBoundingClientRect().top + margin + 8
      const reached = sections.filter(
        ({ element }) => element.getBoundingClientRect().top <= threshold
      )
      const atEnd =
        root!.scrollTop > 0 &&
        root!.scrollHeight - root!.clientHeight - root!.scrollTop < 2
      setActiveId(
        (atEnd ? sections.at(-1) : (reached.at(-1) ?? sections[0]))!.id
      )
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update)
    }
    function restoreAnchor() {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = 0
        let id = ""
        try {
          id = decodeURIComponent(window.location.hash.slice(1))
        } catch {
          // A malformed fragment must not interrupt ordinary scroll tracking.
        }
        const section = items.some(([sectionId]) => sectionId === id)
          ? document.getElementById(id)
          : null
        if (section && root!.contains(section)) {
          const margin =
            parseFloat(getComputedStyle(section).scrollMarginTop) || 24
          root!.scrollTo({
            top:
              root!.scrollTop +
              section.getBoundingClientRect().top -
              root!.getBoundingClientRect().top -
              margin,
            behavior: "instant",
          })
        }
        update()
      })
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(root)
    const content = root.querySelector("#documentation-content")
    if (content) observer.observe(content)
    root.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("hashchange", restoreAnchor)
    window.addEventListener("popstate", restoreAnchor)
    restoreAnchor()
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      root.removeEventListener("scroll", schedule)
      window.removeEventListener("hashchange", restoreAnchor)
      window.removeEventListener("popstate", restoreAnchor)
    }
  }, [items])

  useEffect(() => {
    const navigation = navigationRef.current
    if (!navigation) return
    function measure() {
      const link = navigation!.querySelector<HTMLElement>(
        '[aria-current="location"]'
      )
      if (!link || !link.getClientRects().length) {
        setIndicator((previous) =>
          previous.visible ? { ...previous, visible: false } : previous
        )
        return
      }
      const parent = navigation!.getBoundingClientRect()
      const active = link.getBoundingClientRect()
      setIndicator({
        top: active.top - parent.top,
        height: active.height,
        visible: active.height > 0,
      })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(navigation)
    const frame = requestAnimationFrame(measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [activeId])

  return { navigationRef, activeId, setActiveId, indicator }
}
