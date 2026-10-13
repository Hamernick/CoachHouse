"use client"

import { useEffect, useRef, type RefObject } from "react"

import { cn } from "@/lib/utils"

import { PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME } from "./sidebar-theme"

export function PublicMapEmbeddedBackdrop({
  screenRef,
  contentRef,
  screenVisible = true,
}: {
  screenRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  screenVisible?: boolean
}) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const screen = screenRef.current
    const backdrop = backdropRef.current
    const content = contentRef.current
    const page = screen?.closest<HTMLElement>("[data-public-home-scroll], main")
    if (!screen || !backdrop || !page || !content || page.hasAttribute("data-public-resource-unframed")) return

    let frame = 0
    let previousGeometry = ""
    const updateCutout = () => {
      frame = 0
      const bounds = screen.getBoundingClientRect()
      const pageBounds = page.getBoundingClientRect()
      const scrollTop = page.scrollTop
      const x = bounds.left - pageBounds.left + 1
      const y = bounds.top - pageBounds.top + scrollTop + 1
      const right = bounds.right - pageBounds.left - 1
      const bottom = bounds.bottom - pageBounds.top + scrollTop - 1
      const contentBottom = content.getBoundingClientRect().bottom - pageBounds.top + scrollTop
      const bottomPadding = parseFloat(getComputedStyle(page).paddingBottom) || 0
      // Cover short viewports and the trailing scroll padding without adding space.
      const height = Math.max(page.clientHeight, contentBottom + bottomPadding)
      const geometry = [page.clientWidth, x, y, right, bottom, height].join(":")
      if (geometry === previousGeometry) return
      previousGeometry = geometry
      const radius = 23
      // All layers share content coordinates: scrolling needs no layout reads/writes.
      backdrop.style.height = `${height}px`
      if (!screenVisible) {
        backdrop.style.clipPath = "none"
        return
      }
      // An even-odd clip leaves a rounded hole in the decorative blur.
      const path = [
        `M0 0H${page.clientWidth}V${height}H0Z`,
        `M${x + radius} ${y}H${right - radius}`,
        `A${radius} ${radius} 0 0 1 ${right} ${y + radius}V${bottom - radius}`,
        `A${radius} ${radius} 0 0 1 ${right - radius} ${bottom}H${x + radius}`,
        `A${radius} ${radius} 0 0 1 ${x} ${bottom - radius}V${y + radius}`,
        `A${radius} ${radius} 0 0 1 ${x + radius} ${y}Z`,
      ].join(" ")
      backdrop.style.clipPath = `path(evenodd, "${path}")`
    }
    const scheduleUpdate = () => {
      if (!frame) frame = requestAnimationFrame(updateCutout)
    }

    updateCutout()
    const observer = new ResizeObserver(scheduleUpdate)
    observer.observe(screen)
    observer.observe(page)
    observer.observe(content)
    // Follow the visible content as results, tabs and pagination change.
    window.addEventListener("resize", scheduleUpdate)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener("resize", scheduleUpdate)
    }
  }, [screenRef, contentRef, screenVisible])

  return (
    <div
      ref={backdropRef}
      data-public-map-backdrop=""
      aria-hidden="true"
      style={{ clipPath: screenVisible ? undefined : "none" }}
      className={cn(
        PUBLIC_MAP_OVERLAY_GLASS_CLASSNAME,
        "pointer-events-none absolute inset-x-0 top-0 z-10 h-full border-0"
      )}
    />
  )
}
