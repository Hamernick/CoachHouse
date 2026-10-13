"use client"

import { useEffect, useRef, useState } from "react"
import highlightStyles from "../components/setup-guide-highlight.module.css"
import { SETUP_GUIDE_TARGETS, type SetupGuideStage } from "../lib/setup-guide"
import { placeSetupGuide, type GuideRect, type GuideViewport } from "../lib/setup-guide-placement"

export function useSetupGuideAnchor(stage: SetupGuideStage, open: boolean, compact = false) {
  const cardRef = useRef<HTMLElement>(null)
  const stacked = stage === "identity" || stage === "identity-edit"
  const [geometry, setGeometry] = useState<{ layoutTarget: GuideRect | null; target: GuideRect | null; viewport: GuideViewport; card: { width: number; height: number } } | null>(null)
  useEffect(() => {
    if (!open) return
    const selector = SETUP_GUIDE_TARGETS[stage]
    let overviewScrolled = false
    let frame = 0
    let settleFrame = 0
    let observed: Element | null = null
    let highlighted: HTMLElement | null = null
    const measure = () => {
      frame = 0
      const anchor = selector ? Array.from(document.querySelectorAll<HTMLElement>(selector)).find((el) => el.getClientRects().length > 0) : null
      const target = anchor?.matches(".react-flow__node")
        ? anchor.querySelector<HTMLElement>('[data-slot="card"]') ?? anchor
        : anchor
      const highlightTarget = compact ? null : target ?? null
      if (highlighted !== highlightTarget) {
        highlighted?.classList.remove(highlightStyles.target)
        highlightTarget?.classList.add(highlightStyles.target)
        highlighted = highlightTarget
      }
      if (target !== observed) {
        if (observed) observer.unobserve(observed)
        if (target) {
          observer.observe(target)
          const scroller = target.closest<HTMLElement>('[data-workspace-accelerator-drawer-scroll="true"], [data-organization-scroll-viewport="true"]')
          if (scroller) {
            const bounds = target.getBoundingClientRect()
            const view = scroller.getBoundingClientRect()
            if (bounds.top < view.top || bounds.bottom > view.bottom) scroller.scrollTo({ top: scroller.scrollTop + bounds.top - view.top - 24, behavior: "instant" })
          }
        }
        observed = target ?? null
      }
      if (stage === "story" && !overviewScrolled) {
        const overview = document.querySelector<HTMLElement>('[data-workspace-accelerator-drawer-header-controls="true"]')
        const scroller = overview?.closest<HTMLElement>('[data-workspace-accelerator-drawer-scroll="true"]')
        if (overview && scroller) {
          scroller.scrollTo({ top: scroller.scrollTop + overview.getBoundingClientRect().top - scroller.getBoundingClientRect().top, behavior: "instant" })
          overviewScrolled = true
        }
      }
      const rect = target?.getBoundingClientRect()
      const visual = window.visualViewport
      const portal = cardRef.current?.closest('[data-workspace-setup-walkthrough]')
      const safe = portal ? getComputedStyle(portal) : null
      const viewport: GuideViewport = {
        width: visual?.width ?? window.innerWidth,
        height: visual?.height ?? window.innerHeight,
        left: visual?.offsetLeft ?? 0,
        top: visual?.offsetTop ?? 0,
        insets: { top: parseFloat(safe?.paddingTop ?? "0") || 0, right: parseFloat(safe?.paddingRight ?? "0") || 0, bottom: parseFloat(safe?.paddingBottom ?? "0") || 0, left: parseFloat(safe?.paddingLeft ?? "0") || 0 },
      }
      const canvasBounds = document.querySelector(stacked ? '[data-workspace-canvas-flow-frame="true"]' : '[data-workspace-guide-canvas="true"]')?.getBoundingClientRect()
      if (canvasBounds && canvasBounds.width > 0 && canvasBounds.height > 0) {
        const x = Math.max(viewport.left ?? 0, canvasBounds.left)
        const y = Math.max(viewport.top ?? 0, canvasBounds.top)
        viewport.width = Math.max(1, Math.min((viewport.left ?? 0) + viewport.width, canvasBounds.right) - x)
        viewport.height = Math.max(1, Math.min((viewport.top ?? 0) + viewport.height, canvasBounds.bottom) - y)
        viewport.left = x
        viewport.top = y
      }
      if (stacked) {
        const drawer = document.querySelector('[data-workspace-canvas-overlay-drawer="true"]')?.getBoundingClientRect()
        if (drawer && drawer.top > (viewport.top ?? 0)) {
          viewport.height = Math.min(viewport.height, drawer.top - (viewport.top ?? 0))
        }
      }
      const node = stacked ? anchor?.closest('.react-flow__node') : null
      const layoutBounds = (node?.querySelector<HTMLElement>('[data-slot="card"]') ?? node)?.getBoundingClientRect()
      const left = viewport.left ?? 0
      const top = viewport.top ?? 0
      const right = left + viewport.width
      const bottom = top + viewport.height
      const visible = rect && rect.right > left + 8 && rect.left < right - 8 && rect.bottom > top + 8 && rect.top < bottom - 8
      const next = { layoutTarget: layoutBounds ? { left: layoutBounds.left, top: layoutBounds.top, width: layoutBounds.width, height: layoutBounds.height } : null, target: visible ? { left: Math.max(left + 8, rect.left), top: Math.max(top + 8, rect.top), width: Math.min(rect.right, right - 8) - Math.max(left + 8, rect.left), height: Math.min(rect.bottom, bottom - 8) - Math.max(top + 8, rect.top) } : null, viewport, card: { width: 380, height: cardRef.current?.offsetHeight ?? 320 } }
      setGeometry((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure) }
    const observer = new ResizeObserver(schedule)
    if (cardRef.current) observer.observe(cardRef.current)
    const canvasContainer = document.querySelector('[data-workspace-guide-canvas="true"]')
    if (canvasContainer) observer.observe(canvasContainer)
    const mutation = new MutationObserver(schedule)
    const canvas = document.querySelector(".react-flow__viewport")
    if (canvas) mutation.observe(canvas, { attributes: true, attributeFilter: ["style"] })
    const content = new MutationObserver(schedule)
    content.observe(document.body, { childList: true, subtree: true })
    window.addEventListener("resize", schedule)
    document.addEventListener("scroll", schedule, true)
    window.visualViewport?.addEventListener("resize", schedule)
    window.visualViewport?.addEventListener("scroll", schedule)
    // Follow only the opening camera/drawer animation; no permanent animation loop.
    const until = performance.now() + 1100
    const settle = () => { schedule(); if (performance.now() < until) settleFrame = requestAnimationFrame(settle) }
    settle()
    return () => { highlighted?.classList.remove(highlightStyles.target); cancelAnimationFrame(frame); cancelAnimationFrame(settleFrame); observer.disconnect(); mutation.disconnect(); content.disconnect(); window.removeEventListener("resize", schedule); document.removeEventListener("scroll", schedule, true); window.visualViewport?.removeEventListener("resize", schedule); window.visualViewport?.removeEventListener("scroll", schedule) }
  }, [stage, open, compact, stacked])
  return { cardRef, target: geometry?.target ?? null, position: geometry ? placeSetupGuide(stacked ? geometry.layoutTarget : geometry.target, geometry.viewport, geometry.card, { compact, stack: stacked, contextual: stage !== "welcome" && stage !== "next", above: stage === "people" || stage === "identity-drawer" || stage === "story" }) : null }
}
