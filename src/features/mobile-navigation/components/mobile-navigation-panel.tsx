"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Fragment, useRef, useState, type CSSProperties, type PointerEvent } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useMobileNavigationScroll } from "../hooks/use-mobile-navigation-scroll"
import { resolveMobileNavigationIndex } from "../lib"
import type { MobileNavigationItem } from "../types"
import styles from "./mobile-navigation.module.css"

export function MobileNavigationPanel({
  items,
  embedded = false,
}: {
  items: MobileNavigationItem[]
  embedded?: boolean
}) {
  const router = useRouter()
  const { compact, keyboardOpen } = useMobileNavigationScroll()
  const [scrubIndex, setScrubIndex] = useState<number | null>(null)
  const gesture = useRef<{ x: number; dragging: boolean } | null>(null)
  const suppressClick = useRef(false)
  const selected = items.findIndex((item) => item.active)
  const highlight = scrubIndex ?? selected

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
    const dragging = gesture.current?.dragging
    gesture.current = null
    setScrubIndex(null)
    if (!dragging) return
    suppressClick.current = true
    const index = indexAt(event)
    if (index === null) return
    const item = items[index]
    if (item.href) router.push(item.href)
    else item.onSelect?.()
  }

  return (
    <div className={cn(embedded ? styles.embedded : styles.dock, "md:hidden")} hidden={!embedded && keyboardOpen}>
      <nav
        aria-label="Main navigation"
        className={styles.bar}
        data-compact={!embedded && compact}
        data-scrubbing={scrubIndex !== null}
        style={
          {
            "--tab-count": items.length,
            "--active-index": Math.max(0, highlight),
          } as CSSProperties
        }
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return
          if (items.some((item) => item.render)) return
          suppressClick.current = false
          gesture.current = { x: event.clientX, dragging: false }
        }}
        onPointerMove={(event) => {
          if (!gesture.current) return
          if (Math.abs(event.clientX - gesture.current.x) > 8) {
            gesture.current.dragging = true
            event.currentTarget.setPointerCapture(event.pointerId)
            setScrubIndex(indexAt(event))
          }
        }}
        onPointerUp={finishGesture}
        onPointerCancel={() => {
          gesture.current = null
          setScrubIndex(null)
        }}
        onLostPointerCapture={() => {
          gesture.current = null
          setScrubIndex(null)
        }}
        onClickCapture={(event) => {
          if (!suppressClick.current || event.detail === 0) return
          event.preventDefault()
          event.stopPropagation()
          suppressClick.current = false
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            gesture.current = null
            setScrubIndex(null)
          }
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
            "relative z-10 h-auto min-h-11 min-w-11 flex-col gap-1 rounded-full px-1 py-2 text-xs font-medium hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          )
          if (item.render) {
            return (
              <Fragment key={item.id}>
                {item.render({ className, labelClassName: styles.label })}
              </Fragment>
            )
          }
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
                aria-label={item.label}
                aria-current={item.active ? "page" : undefined}
                draggable={false}
              >
                {contents}
              </Link>
            </Button>
          ) : (
            <Button
              key={item.id}
              type="button"
              variant="ghost"
              className={className}
              data-highlighted={highlight === index}
              aria-label={item.label}
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
