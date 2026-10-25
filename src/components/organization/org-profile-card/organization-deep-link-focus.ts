"use client"

import { useEffect, useRef, type RefObject } from "react"

export const ORGANIZATION_FOCUS_TARGET_CLASSNAME =
  "scroll-mt-24 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[organization-highlighted=true]:bg-blue-100/80 data-[organization-highlighted=true]:ring-2 data-[organization-highlighted=true]:ring-inset data-[organization-highlighted=true]:ring-blue-700/45 dark:data-[organization-highlighted=true]:bg-blue-950/50 dark:data-[organization-highlighted=true]:ring-blue-400/50"

export function getOrganizationFocusTargetProps(focusKey: string) {
  return {
    "data-organization-focus-target": focusKey,
    tabIndex: -1,
  }
}

function findOrganizationFocusTarget(root: HTMLElement, focusKey: string) {
  const targets = Array.from(
    root.querySelectorAll<HTMLElement>("[data-organization-focus-target]")
  ).filter((target) => target.dataset.organizationFocusTarget === focusKey)
  return targets.find((target) => target.offsetParent !== null) ?? targets[0]
}

function scrollOrganizationFocusTarget(target: HTMLElement) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth"
  const viewport = target.closest<HTMLElement>(
    '[data-organization-scroll-viewport="true"]'
  )

  if (!viewport) {
    target.scrollIntoView({ behavior, block: "center", inline: "nearest" })
    return
  }

  const viewportRect = viewport.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  const centeredTop =
    viewport.scrollTop +
    targetRect.top -
    viewportRect.top -
    (viewport.clientHeight - targetRect.height) / 2

  viewport.scrollTo({
    behavior,
    top: Math.max(0, centeredTop),
  })
}

export function useOrganizationDeepLinkFocus({
  enabled = true,
  focusKey,
  requestId,
  rootRef,
}: {
  enabled?: boolean
  focusKey?: string | null
  requestId?: number
  rootRef: RefObject<HTMLElement | null>
}) {
  const handledFocusRef = useRef<{ key: string; requestId?: number } | null>(
    null
  )

  useEffect(() => {
    const normalizedFocus = focusKey?.trim() ?? ""
    if (!enabled || !normalizedFocus) return
    if (
      handledFocusRef.current?.key === normalizedFocus &&
      handledFocusRef.current.requestId === requestId
    )
      return

    let secondFrame = 0
    let highlightTimer = 0
    let highlightedTarget: HTMLElement | null = null
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const root = rootRef.current
        if (!root) return
        const target = findOrganizationFocusTarget(root, normalizedFocus)
        if (!target) return

        handledFocusRef.current = { key: normalizedFocus, requestId }
        highlightedTarget = target
        target.dataset.organizationHighlighted = "true"
        scrollOrganizationFocusTarget(target)
        target.focus({ preventScroll: true })
        highlightTimer = window.setTimeout(() => {
          delete target.dataset.organizationHighlighted
        }, 3200)
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      window.cancelAnimationFrame(secondFrame)
      window.clearTimeout(highlightTimer)
      if (highlightedTarget) {
        delete highlightedTarget.dataset.organizationHighlighted
      }
    }
  }, [enabled, focusKey, requestId, rootRef])
}
