"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type CSSProperties, type PointerEvent } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMobileNavigationScroll } from "../hooks/use-mobile-navigation-scroll"
import type { MobileNavigationItem } from "../types"
import styles from "./mobile-navigation.module.css"

/** A release outside the bar cancels navigation. */
function resolveMobileNavigationIndex({
  x,
  y,
  left,
  top,
  width,
  height,
  count,
}: {
  x: number
  y: number
  left: number
  top: number
  width: number
  height: number
  count: number
}): number | null {
  if (
    width <= 0 ||
    count < 1 ||
    x < left ||
    x > left + width ||
    y < top ||
    y > top + height
  )
    return null
  return Math.min(count - 1, Math.floor(((x - left) / width) * count))
}

export function MobileNavigationPanel({
  items,
}: {
  items: MobileNavigationItem[]
}) {
  const router = useRouter()
  const { compact, keyboardOpen } = useMobileNavigationScroll()
  const [scrubIndex, setScrubIndex] = useState<number | null>(null)
  const gesture = useRef<{
    pointerId: number
    startX: number
    dragging: boolean
    canceled: boolean
  } | null>(null)
  const suppressClick = useRef(false)
  const suppressionTimer = useRef<number | null>(null)
  const selected = items.findIndex((item) => item.active)
  const highlight = scrubIndex ?? selected

  function clearClickSuppression() {
    suppressClick.current = false
    if (suppressionTimer.current !== null) {
      window.clearTimeout(suppressionTimer.current)
      suppressionTimer.current = null
    }
  }

  function suppressReleasedPointerClick() {
    clearClickSuppression()
    suppressClick.current = true
    suppressionTimer.current = window.setTimeout(() => {
      suppressClick.current = false
      suppressionTimer.current = null
    }, 0)
  }

  function indexAt(event: PointerEvent<HTMLElement>) {
    const { left, top, width, height } =
      event.currentTarget.getBoundingClientRect()
    return resolveMobileNavigationIndex({
      x: event.clientX,
      y: event.clientY,
      left,
      top,
      width,
      height,
      count: items.length,
    })
  }

  function finishGesture(event: PointerEvent<HTMLElement>) {
    const current = gesture.current
    if (!current || current.pointerId !== event.pointerId) return
    gesture.current = null
    setScrubIndex(null)
    if (!current.dragging && !current.canceled) return

    suppressReleasedPointerClick()
    if (current.canceled) return
    const index = indexAt(event)
    if (index === null) return
    const item = items[index]
    if (item.href) router.push(item.href)
    else item.onSelect?.()
  }

  return (
    <div className={cn(styles.dock, "md:hidden")} hidden={keyboardOpen}>
      <nav
        aria-label="Main navigation"
        className={styles.bar}
        data-compact={compact}
        data-scrubbing={scrubIndex !== null}
        style={
          {
            "--tab-count": items.length,
            "--active-index": Math.max(0, highlight),
          } as CSSProperties
        }
        onPointerDown={(event) => {
          if (
            !event.isPrimary ||
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return
          clearClickSuppression()
          gesture.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            dragging: false,
            canceled: false,
          }
        }}
        onPointerMove={(event) => {
          const current = gesture.current
          if (
            !current ||
            current.pointerId !== event.pointerId ||
            current.canceled
          )
            return
          if (Math.abs(event.clientX - current.startX) > 8) {
            current.dragging = true
            if (!event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.setPointerCapture(event.pointerId)
            setScrubIndex(indexAt(event))
          }
        }}
        onPointerUp={finishGesture}
        onPointerCancel={(event) => {
          if (gesture.current?.pointerId !== event.pointerId) return
          gesture.current = null
          setScrubIndex(null)
          clearClickSuppression()
        }}
        onLostPointerCapture={(event) => {
          if (event.target !== event.currentTarget) return
          if (gesture.current?.pointerId !== event.pointerId) return
          gesture.current = null
          setScrubIndex(null)
          clearClickSuppression()
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current || event.detail === 0) return
          event.preventDefault()
          event.stopPropagation()
          clearClickSuppression()
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !gesture.current) return
          gesture.current.canceled = true
          setScrubIndex(null)
        }}
      >
        <span
          className={styles.highlight}
          data-visible={highlight >= 0}
          aria-hidden
        />
        {items.map((item, index) => {
          const Icon = item.icon
          const contents = (
            <>
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className={styles.label}>{item.label}</span>
            </>
          )
          const className = cn(
            styles.tab,
            "relative z-10 h-auto min-h-11 min-w-11 flex-col gap-1 rounded-full px-1 py-2 text-xs font-medium touch-manipulation hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          )
          return item.href ? (
            <Button
              key={item.id}
              asChild
              variant="ghost"
              className={className}
              data-highlighted={highlight === index}
            >
              <Link
                href={item.href}
                prefetch={false}
                aria-current={item.active ? "page" : undefined}
                draggable={false}
              >
                {contents}
              </Link>
            </Button>
          ) : (
            <Button
              key={item.id}
              ref={item.buttonRef}
              type="button"
              variant="ghost"
              className={className}
              data-highlighted={highlight === index}
              aria-expanded={item.expanded}
              aria-controls={item.controls}
              onClick={item.onSelect}
            >
              {contents}
            </Button>
          )
        })}
      </nav>
    </div>
  )
}
