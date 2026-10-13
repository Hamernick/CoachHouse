"use client"

import { useEffect, useRef } from "react"

/** Reframe on container, node, or natural guide size changes, never on camera transforms. */
export function useSetupGuideStackResize(active: boolean, onFocus: () => void) {
  const focus = useRef(onFocus)
  focus.current = onFocus
  useEffect(() => {
    if (!active) return
    const frame = document.querySelector<HTMLElement>('[data-workspace-canvas-flow-frame="true"]')
    const node = document.querySelector<HTMLElement>('.react-flow__node[data-id="organization-overview"]')
    const guide = document.querySelector<HTMLElement>('[data-workspace-setup-walkthrough] aside')
    if (!frame) return
    let animationFrame = 0
    const dimensions = () => [frame.clientWidth, frame.clientHeight, node?.offsetWidth, node?.offsetHeight, guide?.offsetHeight].join(":")
    let previous = dimensions()
    const observer = new ResizeObserver(() => {
      const next = dimensions()
      if (next === previous) return
      previous = next
      cancelAnimationFrame(animationFrame)
      animationFrame = requestAnimationFrame(() => focus.current())
    })
    observer.observe(frame)
    if (node) observer.observe(node)
    if (guide) observer.observe(guide)
    return () => { observer.disconnect(); cancelAnimationFrame(animationFrame) }
  }, [active])
}
