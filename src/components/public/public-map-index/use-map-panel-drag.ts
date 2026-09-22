"use client"

import { useRef, useState, type MouseEvent, type PointerEvent } from "react"

export function useMapPanelDrag({
  frame,
  host,
  collapsedHeight,
  middleHeight,
  onSnap,
}: {
  frame: HTMLElement | null
  host: HTMLElement | null
  collapsedHeight: string
  middleHeight: string
  onSnap: (index: 0 | 1 | 2) => void
}) {
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const gesture = useRef<{ y: number; height: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const clear = () => { gesture.current = null; setDragHeight(null) }
  const minimumHeight = Number.parseFloat(collapsedHeight)
  const heights = () => [minimumHeight, Math.min(Number.parseFloat(middleHeight), host?.clientHeight ?? 844), host?.clientHeight ?? 844]
  const heightAt = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current!
    return Math.min(heights()[2], Math.max(minimumHeight, start.height + start.y - event.clientY))
  }
  return {
    dragHeight,
    handlers: {
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (!event.isPrimary || event.button !== 0 || !frame) return
        suppressClick.current = false
        gesture.current = { y: event.clientY, height: frame.clientHeight, moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      },
      onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
        if (!gesture.current) return
        if (Math.abs(event.clientY - gesture.current.y) > 6) gesture.current.moved = true
        if (gesture.current.moved) setDragHeight(heightAt(event))
      },
      onPointerUp: (event: PointerEvent<HTMLButtonElement>) => {
        if (gesture.current?.moved) {
          const height = heightAt(event)
          const points = heights()
          const index = points.reduce((best, point, i) => Math.abs(point - height) < Math.abs(points[best] - height) ? i : best, 0)
          suppressClick.current = true
          onSnap(index as 0 | 1 | 2)
        }
        clear()
      },
      onPointerCancel: clear,
      onLostPointerCapture: clear,
      onClickCapture: (event: MouseEvent<HTMLButtonElement>) => {
        if (!suppressClick.current || event.detail === 0) return
        event.preventDefault()
        event.stopPropagation()
        suppressClick.current = false
      },
    },
  }
}
